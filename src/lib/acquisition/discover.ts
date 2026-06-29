import { aiJson } from "../ai";
import { domainFromUrl } from "../utils";
import { webSearch } from "../integrations/search";
import { fetchDoc, type SiteProfile } from "./siteCrawl";

export interface CompetitorCandidate {
  domain: string;
  score: number;
  sources: string[];
}

export interface DiscoverOptions {
  category: string;
  /** Max candidates to return. */
  max?: number;
  /** Whether to verify each candidate resolves to a live HTML page. */
  verify?: boolean;
}

/**
 * Domains that show up in "alternatives"/"vs" searches but are never the
 * actual competitor: social networks, review aggregators, media, and dev hubs.
 */
const BLOCKED_DOMAINS = new Set([
  "wikipedia.org",
  "youtube.com",
  "reddit.com",
  "medium.com",
  "github.com",
  "gitlab.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "g2.com",
  "capterra.com",
  "getapp.com",
  "trustradius.com",
  "producthunt.com",
  "quora.com",
  "gartner.com",
  "forbes.com",
  "techcrunch.com",
  "slant.co",
  "softwareadvice.com",
  "pcmag.com",
  "trustpilot.com",
  "stackoverflow.com",
  "ycombinator.com",
  "crunchbase.com",
  "wordpress.org",
  "apple.com",
  "google.com",
  "microsoft.com",
  "amazon.com",
  "pinterest.com",
  "play.google.com",
  "apps.apple.com",
  "itunes.apple.com",
  "support.apple.com",
  "support.google.com",
  "accounts.google.com",
  "chrome.google.com",
  "addons.mozilla.org",
  "tiktok.com",
  "bing.com",
  "duckduckgo.com",
]);

function isUsableDomain(domain: string, self: string): boolean {
  if (!domain || domain === self) return false;
  if (domain.endsWith(`.${self}`) || self.endsWith(`.${domain}`)) return false;
  if (BLOCKED_DOMAINS.has(domain)) return false;
  // Drop bare TLDs / obviously invalid hostnames.
  if (!domain.includes(".")) return false;
  return true;
}

const STOP = new Set([
  "the", "a", "an", "and", "or", "for", "with", "your", "you", "our", "to", "of",
  "in", "on", "is", "are", "it", "that", "this", "all", "more", "get", "use",
  "app", "apps", "tool", "tools", "software", "platform", "free", "best", "new",
  "from", "by", "as", "at", "be", "can", "how", "what", "why", "make", "build",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
}

/** Derive a few salient topic keywords from the crawl to disambiguate generic brand names. */
function topicHint(site: SiteProfile, name: string): string {
  const text = [site.description, ...site.valueProps.slice(0, 4), ...site.features.slice(0, 10)]
    .filter(Boolean)
    .join(" ");
  const nameTokens = new Set(tokenize(name));
  const freq = new Map<string, number>();
  for (const tok of tokenize(text)) {
    if (nameTokens.has(tok)) continue;
    freq.set(tok, (freq.get(tok) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map((e) => e[0])
    .join(" ");
}

/** Collect distinct external domains an article links out to (competitor mentions). */
function outboundDomains(root: import("node-html-parser").HTMLElement, articleDomain: string): string[] {
  const seen = new Set<string>();
  for (const a of root.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href") ?? "";
    if (!/^https?:\/\//.test(href)) continue;
    const d = domainFromUrl(href);
    if (!d || d === articleDomain) continue;
    seen.add(d);
  }
  return [...seen];
}

/**
 * Hybrid competitor discovery. Combines public web search (SerpAPI when keyed,
 * DuckDuckGo otherwise) with an LLM suggestion pass grounded in the crawled
 * site profile. Returns ranked, deduped, optionally-verified candidates.
 */
export async function discoverCompetitors(
  site: SiteProfile,
  opts: DiscoverOptions,
): Promise<CompetitorCandidate[]> {
  const { category, max = 6, verify = true } = opts;
  const self = site.domain;
  const name = site.name || self.split(".")[0];
  const tally = new Map<string, CompetitorCandidate>();

  const add = (domain: string, source: string, weight: number) => {
    const d = domainFromUrl(domain);
    if (!isUsableDomain(d, self)) return;
    const existing = tally.get(d);
    if (existing) {
      existing.score += weight;
      if (!existing.sources.includes(source)) existing.sources.push(source);
    } else {
      tally.set(d, { domain: d, score: weight, sources: [source] });
    }
  };

  // 1. LLM suggestions grounded in the real crawl (most precise signal).
  const { data: ai } = await aiJson<{ competitors: string[] }>({
    system:
      "You are a competitive-intelligence analyst. Given a company's crawled marketing profile, list its 5-8 most direct competitors as bare domains (e.g. example.com). Only real, well-known companies in the same category. Return JSON {competitors:[...]}.",
    prompt: [
      `Company: ${name} (${site.url})`,
      `Category: ${category}`,
      site.description && `Description: ${site.description}`,
      site.valueProps.length && `Value props: ${site.valueProps.slice(0, 6).join(" | ")}`,
      site.features.length && `Features: ${site.features.slice(0, 12).join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n"),
    fallback: { competitors: [] },
  });
  for (const c of ai.competitors ?? []) add(c, "ai", 4);

  // 2. Public discovery: harvest competitor domains from inside "best/alternatives"
  // listicles. Organic result domains are usually the brand itself or review
  // aggregators; the actual products are the outbound links *within* those
  // articles, so domains cited across multiple articles bubble to the top.
  // Ground queries in real crawled topics so generic/ambiguous brand names
  // (e.g. "Obsidian", "Linear") don't pull in dictionary/listicle noise.
  const hint = topicHint(site, name) || category;
  const queries = [
    `best ${hint} software`,
    `${name} alternatives ${hint}`,
    `top ${hint} tools`,
    `${hint} comparison`,
  ];
  const searchResults = (await Promise.all(queries.map((q) => webSearch(q, 10)))).flat();
  const articles = searchResults
    .filter((r) => /alternative|best|top|vs\b|compar|competitor|tools/i.test(r.title))
    .filter((r) => domainFromUrl(r.url) !== self)
    .slice(0, 6);
  for (const art of articles) {
    const doc = await fetchDoc(art.url, 8000);
    if (!doc) continue;
    for (const d of outboundDomains(doc.root, domainFromUrl(art.url))) add(d, "listicle", 1);
  }

  // Rank: prefer AI-suggested or cross-listicle candidates, which filters out
  // one-off noise links found in a single article. Without AI to ground the
  // category, require stronger corroboration (cited across more listicles).
  const ranked = [...tally.values()].sort((a, b) => b.score - a.score);
  const minScore = (ai.competitors?.length ?? 0) > 0 ? 2 : 3;
  const corroborated = ranked.filter((c) => c.sources.includes("ai") || c.score >= minScore);
  const pool = corroborated.length ? corroborated : ranked.filter((c) => c.score >= 2);

  if (!verify) return pool.slice(0, max);

  // 3. Verify the top candidates resolve to a live HTML page before returning.
  const verified: CompetitorCandidate[] = [];
  for (const cand of pool) {
    if (verified.length >= max) break;
    const doc = await fetchDoc(`https://${cand.domain}`, 8000);
    if (doc) verified.push(cand);
  }
  return verified.length ? verified : pool.slice(0, max);
}
