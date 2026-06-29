import { parse, type HTMLElement } from "node-html-parser";
import { normalizeUrl, domainFromUrl } from "../utils";
import { crawlSite, type CrawlResult } from "../integrations/crawl";

// A browser-like UA: many marketing sites serve bot UAs an empty/blocked page.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 BroadcastBot/1.0";
const FETCH_TIMEOUT = 12000;

export type PageKind =
  | "home"
  | "pricing"
  | "features"
  | "product"
  | "about"
  | "blog"
  | "docs"
  | "customers"
  | "other";

export interface PricingTier {
  name: string;
  price?: string;
  period?: string;
  features: string[];
}

export interface PageSummary {
  url: string;
  path: string;
  kind: PageKind;
  title?: string;
  description?: string;
  headings: string[];
  wordCount: number;
}

export interface SiteProfile {
  url: string;
  domain: string;
  name?: string;
  tagline?: string;
  description?: string;
  valueProps: string[];
  features: string[];
  pricingTiers: PricingTier[];
  socialLinks: Record<string, string>;
  pages: PageSummary[];
  blogTopics: string[];
  techSignals: string[];
  homepage: CrawlResult;
  fetchedAt: string;
}

export interface SiteCrawlOptions {
  /** Max number of pages to fetch (including the homepage). */
  maxPages?: number;
  /** Max concurrent fetches. */
  concurrency?: number;
  /** Per-request timeout in ms. */
  timeout?: number;
}

interface FetchedDoc {
  url: string;
  root: HTMLElement;
  status: number;
}

/** Fetch + parse an HTML document. Returns null on any failure or non-HTML. */
export async function fetchDoc(rawUrl: string, timeout = FETCH_TIMEOUT): Promise<FetchedDoc | null> {
  const url = normalizeUrl(rawUrl);
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": UA }, redirect: "follow" });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("html")) return null;
    const html = await res.text();
    return { url: res.url || url, root: parse(html), status: res.status };
  } catch {
    return null;
  }
}

async function fetchText(rawUrl: string, timeout = FETCH_TIMEOUT): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(normalizeUrl(rawUrl), { signal: controller.signal, headers: { "User-Agent": UA } });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let idx = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (idx < items.length) {
      const cur = idx++;
      results[cur] = await fn(items[cur]);
    }
  });
  await Promise.all(workers);
  return results;
}

const PAGE_RULES: { kind: PageKind; pattern: RegExp }[] = [
  { kind: "pricing", pattern: /(^|\/)(pricing|plans?|price)(\/|$|\?)/i },
  { kind: "features", pattern: /(^|\/)(features?|platform|solutions?|capabilities)(\/|$|\?)/i },
  { kind: "product", pattern: /(^|\/)(product|products|how-it-works)(\/|$|\?)/i },
  { kind: "customers", pattern: /(^|\/)(customers?|case-stud|testimonials|stories)(\/|$|\?)/i },
  { kind: "about", pattern: /(^|\/)(about|company|team|mission)(\/|$|\?)/i },
  { kind: "blog", pattern: /(^|\/)(blog|articles?|resources?|news|insights)(\/|$|\?)/i },
  { kind: "docs", pattern: /(^|\/)(docs?|documentation|guides?|help)(\/|$|\?)/i },
];

function classifyPath(path: string): PageKind {
  if (path === "/" || path === "") return "home";
  for (const { kind, pattern } of PAGE_RULES) if (pattern.test(path)) return kind;
  return "other";
}

function toAbsolute(href: string, baseUrl: string): string | null {
  if (!href) return null;
  if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
    return null;
  }
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function sameDomain(url: string, domain: string): boolean {
  return domainFromUrl(url) === domain;
}

function stripHashQuery(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return url.split("#")[0].split("?")[0].replace(/\/$/, "");
  }
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return "/";
  }
}

/** Collect same-domain candidate URLs from the homepage nav, sitemap, and robots.txt. */
async function discoverUrls(home: FetchedDoc, baseUrl: string, domain: string): Promise<string[]> {
  const found = new Set<string>();

  for (const a of home.root.querySelectorAll("a[href]")) {
    const abs = toAbsolute(a.getAttribute("href") ?? "", baseUrl);
    if (abs && sameDomain(abs, domain)) found.add(stripHashQuery(abs));
  }

  const robots = await fetchText(`${baseUrl}/robots.txt`);
  const sitemaps = new Set<string>([`${baseUrl}/sitemap.xml`]);
  if (robots) {
    for (const m of robots.matchAll(/sitemap:\s*(\S+)/gi)) sitemaps.add(m[1].trim());
  }
  for (const sm of [...sitemaps].slice(0, 3)) {
    const xml = await fetchText(sm);
    if (!xml) continue;
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
      const u = m[1].trim();
      if (sameDomain(u, domain) && !/\.(xml|jpg|jpeg|png|gif|svg|webp|pdf)$/i.test(u)) {
        found.add(stripHashQuery(u));
      }
    }
  }

  return [...found];
}

/** Pick the most useful pages to crawl, biased toward high-signal page kinds. */
function selectPages(urls: string[], home: string, maxPages: number): string[] {
  const homeNorm = stripHashQuery(home);
  const byKind = new Map<PageKind, string[]>();
  for (const u of urls) {
    if (u === homeNorm) continue;
    const kind = classifyPath(pathOf(u));
    if (!byKind.has(kind)) byKind.set(kind, []);
    byKind.get(kind)!.push(u);
  }
  for (const list of byKind.values()) list.sort((a, b) => pathOf(a).length - pathOf(b).length);

  const quota: [PageKind, number][] = [
    ["pricing", 1],
    ["features", 2],
    ["product", 1],
    ["about", 1],
    ["customers", 1],
    ["blog", 1],
    ["docs", 1],
  ];

  const selected: string[] = [];
  for (const [kind, n] of quota) {
    for (const u of (byKind.get(kind) ?? []).slice(0, n)) {
      if (selected.length >= maxPages - 1) break;
      selected.push(u);
    }
  }
  // Fill any remaining budget with the shortest "other" paths.
  if (selected.length < maxPages - 1) {
    for (const u of byKind.get("other") ?? []) {
      if (selected.length >= maxPages - 1) break;
      if (!selected.includes(u)) selected.push(u);
    }
  }
  return selected;
}

function cleanText(s: string | undefined | null): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function headingsOf(root: HTMLElement, max = 12): string[] {
  return root
    .querySelectorAll("h1, h2, h3")
    .map((h) => cleanText(h.text))
    .filter((t) => t.length >= 3 && t.length <= 140)
    .slice(0, max);
}

function summarizePage(doc: FetchedDoc): PageSummary {
  const path = pathOf(doc.url);
  const title = cleanText(doc.root.querySelector("title")?.text);
  const description = cleanText(doc.root.querySelector('meta[name="description"]')?.getAttribute("content"));
  const bodyText = cleanText(doc.root.querySelector("body")?.text);
  return {
    url: doc.url,
    path,
    kind: classifyPath(path),
    title: title || undefined,
    description: description || undefined,
    headings: headingsOf(doc.root),
    wordCount: bodyText ? bodyText.split(" ").length : 0,
  };
}

const SOCIAL_HOSTS: Record<string, string> = {
  "twitter.com": "twitter",
  "x.com": "twitter",
  "linkedin.com": "linkedin",
  "github.com": "github",
  "youtube.com": "youtube",
  "facebook.com": "facebook",
  "instagram.com": "instagram",
  "discord.gg": "discord",
  "discord.com": "discord",
  "t.me": "telegram",
};

function extractSocialLinks(root: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of root.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href") ?? "";
    let host: string;
    try {
      host = new URL(href).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    for (const [needle, platform] of Object.entries(SOCIAL_HOSTS)) {
      if (host.endsWith(needle) && !out[platform]) out[platform] = href;
    }
  }
  return out;
}

function extractValueProps(home: FetchedDoc): string[] {
  const props: string[] = [];
  for (const sel of ["h1", "h2"]) {
    for (const el of home.root.querySelectorAll(sel)) {
      const t = cleanText(el.text);
      if (t.length >= 6 && t.length <= 120) props.push(t);
    }
  }
  // Hero-level paragraphs near the top of the page.
  for (const p of home.root.querySelectorAll("p").slice(0, 8)) {
    const t = cleanText(p.text);
    if (t.length >= 30 && t.length <= 220) props.push(t);
  }
  return dedupe(props).slice(0, 8);
}

const NAV_WORDS = new Set([
  "download", "login", "log in", "sign in", "sign up", "pricing", "blog", "docs",
  "documentation", "careers", "security", "changelog", "community", "about",
  "contact", "terms", "privacy", "status", "merch", "merch store", "store",
  "help", "support", "home", "features", "product", "customers", "company",
  "developers", "resources", "newsletter", "cookies", "english", "more",
  "get started", "learn more", "read more", "twitter", "github", "linkedin",
]);

/** Reject nav links, language switchers, and other non-feature list items. */
function looksLikeFeature(t: string): boolean {
  const low = t.toLowerCase();
  if (NAV_WORDS.has(low)) return false;
  // Language switchers and localized nav are non-latin heavy.
  const nonAscii = (t.match(/[^\x00-\x7F]/g) ?? []).length;
  if (nonAscii > t.length * 0.3) return false;
  // Tiny single words are almost always nav, not features.
  if (t.split(" ").length === 1 && t.length < 7) return false;
  return true;
}

function extractFeatures(docs: FetchedDoc[]): string[] {
  const features: string[] = [];
  for (const doc of docs) {
    for (const li of doc.root.querySelectorAll("li")) {
      const t = cleanText(li.text);
      // Feature bullets tend to be short, declarative phrases.
      if (t.length >= 8 && t.length <= 110 && t.split(" ").length <= 16 && looksLikeFeature(t)) {
        features.push(t);
      }
    }
    for (const h of doc.root.querySelectorAll("h3")) {
      const t = cleanText(h.text);
      if (t.length >= 4 && t.length <= 60 && looksLikeFeature(t)) features.push(t);
    }
  }
  return dedupe(features).slice(0, 24);
}

const PRICE_RE = /([$£€]\s?\d[\d,.]*)/;
const PERIOD_RE = /(\/\s?(mo|month|yr|year|user|seat)|per\s+(month|year|user|seat)|monthly|annually|yearly)/i;

function extractPricingTiers(pricingDoc: FetchedDoc | undefined): PricingTier[] {
  if (!pricingDoc) return [];
  const tiers: PricingTier[] = [];
  const seen = new Set<string>();

  // Look for "card"-like containers that include a price token.
  const candidates = pricingDoc.root.querySelectorAll(
    "[class*='plan'], [class*='tier'], [class*='price'], [class*='card'], section, article, li",
  );
  for (const el of candidates) {
    const text = cleanText(el.text);
    if (!text) continue;
    const priceMatch = text.match(PRICE_RE);
    const isFreeOrCustom = /\b(free|custom|contact sales|enterprise)\b/i.test(text);
    if (!priceMatch && !isFreeOrCustom) continue;
    // Avoid huge containers (whole page) — keep reasonably sized cards.
    if (text.length > 600) continue;

    const heading = el.querySelector("h1, h2, h3, h4, [class*='name'], [class*='title']");
    const name = cleanText(heading?.text).slice(0, 40) || (isFreeOrCustom && !priceMatch ? "Custom" : "Plan");
    const key = `${name}:${priceMatch?.[1] ?? (isFreeOrCustom ? "free/custom" : "")}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const periodMatch = text.match(PERIOD_RE);
    const features = el
      .querySelectorAll("li")
      .map((li) => cleanText(li.text))
      .filter((t) => t.length >= 4 && t.length <= 90)
      .slice(0, 8);

    tiers.push({
      name,
      price: priceMatch?.[1]?.replace(/\s+/g, "") ?? (isFreeOrCustom ? (/free/i.test(text) ? "Free" : "Custom") : undefined),
      period: periodMatch?.[0]?.replace(/\s+/g, " ").trim(),
      features,
    });
    if (tiers.length >= 6) break;
  }
  return tiers;
}

function extractBlogTopics(blogDoc: FetchedDoc | undefined): string[] {
  if (!blogDoc) return [];
  const topics: string[] = [];
  for (const el of blogDoc.root.querySelectorAll("article h2, article h3, h2 a, h3 a, [class*='post'] a, [class*='article'] a")) {
    const t = cleanText(el.text);
    if (t.length >= 12 && t.length <= 140) topics.push(t);
  }
  return dedupe(topics).slice(0, 12);
}

function detectTech(home: FetchedDoc, homepage: CrawlResult): string[] {
  const signals = new Set<string>(homepage.structuredDataTypes ?? []);
  const html = home.root.toString().toLowerCase();
  const checks: [string, RegExp][] = [
    ["Next.js", /__next_data__|\/_next\//],
    ["WordPress", /wp-content|wp-json/],
    ["Shopify", /cdn\.shopify\.com|shopify/],
    ["Webflow", /webflow/],
    ["HubSpot", /hs-scripts|hubspot/],
    ["Framer", /framerusercontent|framer\.com/],
    ["Gatsby", /gatsby/],
  ];
  for (const [name, re] of checks) if (re.test(html)) signals.add(name);
  return [...signals].slice(0, 8);
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of arr) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function guessName(homepage: CrawlResult, domain: string): string {
  const fromTitle = homepage.title?.split(/[|\-–—:·•]/)[0]?.trim();
  if (fromTitle && fromTitle.length >= 2 && fromTitle.length <= 40) return fromTitle;
  const base = domain.split(".")[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Crawl a site across its key pages and assemble a structured marketing profile.
 * Always returns a profile; degrades gracefully when pages are unreachable.
 */
export async function crawlSiteProfile(rawUrl: string, opts: SiteCrawlOptions = {}): Promise<SiteProfile> {
  const { maxPages = 10, concurrency = 3, timeout = FETCH_TIMEOUT } = opts;
  const url = normalizeUrl(rawUrl);
  const domain = domainFromUrl(url);
  const fetchedAt = new Date().toISOString();

  // Homepage SEO crawl (reuses the existing single-page auditor) + DOM for extraction.
  const [homepage, homeDoc] = await Promise.all([crawlSite(url), fetchDoc(url, timeout)]);

  if (!homeDoc) {
    return {
      url,
      domain,
      name: guessName(homepage, domain),
      tagline: homepage.title,
      description: homepage.metaDescription,
      valueProps: homepage.h1s ?? [],
      features: [],
      pricingTiers: [],
      socialLinks: {},
      pages: [],
      blogTopics: [],
      techSignals: homepage.structuredDataTypes ?? [],
      homepage,
      fetchedAt,
    };
  }

  const candidates = await discoverUrls(homeDoc, url, domain);
  const toFetch = selectPages(candidates, url, maxPages);
  const fetched = (await mapLimit(toFetch, concurrency, (u) => fetchDoc(u, timeout))).filter(
    (d): d is FetchedDoc => Boolean(d),
  );

  const allDocs = [homeDoc, ...fetched];
  const pages = allDocs.map(summarizePage);
  const byKind = (kind: PageKind) => fetched.find((d) => classifyPath(pathOf(d.url)) === kind);

  const featureDocs = allDocs.filter((d) => ["home", "features", "product"].includes(classifyPath(pathOf(d.url))));

  return {
    url,
    domain,
    name: guessName(homepage, domain),
    tagline: homepage.title,
    description: homepage.metaDescription,
    valueProps: extractValueProps(homeDoc),
    features: extractFeatures(featureDocs),
    pricingTiers: extractPricingTiers(byKind("pricing")),
    socialLinks: extractSocialLinks(homeDoc.root),
    pages,
    blogTopics: extractBlogTopics(byKind("blog")),
    techSignals: detectTech(homeDoc, homepage),
    homepage,
    fetchedAt,
  };
}
