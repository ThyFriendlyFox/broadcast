import { aiText } from "../ai";
import type { SiteProfile, PricingTier } from "./siteCrawl";
import type { CompetitorProfile } from "./competitor";

// ── Structured competitor analysis (rendered richly in the UI) ───────────────

export interface PositioningEntry {
  name: string;
  domain: string;
  positioning: string;
  audience?: string;
  pricingFrom?: string;
  isYou?: boolean;
}

export interface FeatureComparisonRow {
  feature: string;
  you: boolean;
  competitors: Record<string, boolean>;
}

export interface ContentGap {
  topic: string;
  coveredBy: string[];
}

export interface PricingComparisonRow {
  name: string;
  domain: string;
  isYou?: boolean;
  tiers: PricingTier[];
}

export interface CompetitorAnalysis {
  generatedAt: string;
  summary: string;
  positioning: PositioningEntry[];
  featureComparison: FeatureComparisonRow[];
  contentGaps: ContentGap[];
  pricing: PricingComparisonRow[];
  competitorsAnalyzed: number;
  source: "ai" | "local";
}

export interface SynthesisResult {
  documents: {
    productInformation: string;
    brandVoice: string;
    marketingStrategy: string;
    llmsTxt: string;
    competitorAnalysis: string;
  };
  analysis: CompetitorAnalysis;
  source: "ai" | "local";
}

// ── Text helpers ─────────────────────────────────────────────────────────────

const STOP = new Set([
  "the", "a", "an", "and", "or", "for", "with", "your", "you", "our", "to", "of",
  "in", "on", "is", "are", "it", "that", "this", "all", "more", "get", "using",
  "use", "via", "by", "from", "as", "at", "be", "can", "how", "what", "why",
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function keyphrase(s: string): string {
  return tokens(s).slice(0, 4).join(" ");
}

function overlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const set = new Set(b);
  const hits = a.filter((t) => set.has(t)).length;
  return hits / Math.min(a.length, b.length);
}

function listHas(list: string[], phrase: string, threshold = 0.5): boolean {
  const ft = tokens(phrase);
  if (!ft.length) return false;
  return list.some((item) => overlap(ft, tokens(item)) >= threshold);
}

function dedupeByKeyphrase(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = keyphrase(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function pricingFrom(tiers: PricingTier[]): string | undefined {
  const priced = tiers.map((t) => t.price).filter((p): p is string => Boolean(p));
  const numeric = priced.filter((p) => /\d/.test(p));
  if (numeric.length) return numeric[0];
  if (priced.length) return priced[0];
  return undefined;
}

// ── Competitor analysis ──────────────────────────────────────────────────────

function buildPositioning(site: SiteProfile, competitors: CompetitorProfile[]): PositioningEntry[] {
  const you: PositioningEntry = {
    name: site.name || site.domain,
    domain: site.domain,
    positioning: site.valueProps[0] || site.description || "Your product.",
    pricingFrom: pricingFrom(site.pricingTiers),
    isYou: true,
  };
  const rest = competitors.map((c) => ({
    name: c.name || c.domain,
    domain: c.domain,
    positioning: c.positioning || c.description || "—",
    audience: c.audience || undefined,
    pricingFrom: pricingFrom(c.pricingTiers),
  }));
  return [you, ...rest];
}

function buildFeatureComparison(site: SiteProfile, competitors: CompetitorProfile[]): FeatureComparisonRow[] {
  const universe = dedupeByKeyphrase([
    ...site.features,
    ...competitors.flatMap((c) => c.features),
  ]);

  const rows: FeatureComparisonRow[] = universe.map((feature) => ({
    feature,
    you: listHas(site.features, feature),
    competitors: Object.fromEntries(competitors.map((c) => [c.domain, listHas(c.features, feature)])),
  }));

  // Keep only rows with variance across players (these are the actionable gaps).
  const informative = rows.filter((r) => {
    const vals = [r.you, ...Object.values(r.competitors)];
    return new Set(vals).size > 1;
  });

  // Surface your gaps first (features rivals have that you don't).
  informative.sort((a, b) => Number(a.you) - Number(b.you));
  return informative.slice(0, 14);
}

function buildContentGaps(site: SiteProfile, competitors: CompetitorProfile[]): ContentGap[] {
  const yourCoverage = [...site.blogTopics, ...site.features, ...site.valueProps];
  const byKey = new Map<string, { topic: string; domains: Set<string> }>();

  for (const c of competitors) {
    for (const topic of c.blogTopics) {
      const key = keyphrase(topic);
      if (!key) continue;
      if (!byKey.has(key)) byKey.set(key, { topic, domains: new Set() });
      byKey.get(key)!.domains.add(c.domain);
    }
  }

  const gaps: ContentGap[] = [];
  for (const { topic, domains } of byKey.values()) {
    if (listHas(yourCoverage, topic, 0.4)) continue; // you already cover it
    gaps.push({ topic, coveredBy: [...domains] });
  }
  // Prioritize topics multiple competitors cover.
  gaps.sort((a, b) => b.coveredBy.length - a.coveredBy.length);
  return gaps.slice(0, 8);
}

function buildPricingComparison(site: SiteProfile, competitors: CompetitorProfile[]): PricingComparisonRow[] {
  const rows: PricingComparisonRow[] = [];
  if (site.pricingTiers.length) {
    rows.push({ name: site.name || site.domain, domain: site.domain, isYou: true, tiers: site.pricingTiers });
  }
  for (const c of competitors) {
    if (c.pricingTiers.length) rows.push({ name: c.name || c.domain, domain: c.domain, tiers: c.pricingTiers });
  }
  return rows;
}

function localSummary(site: SiteProfile, competitors: CompetitorProfile[], gaps: ContentGap[], featureRows: FeatureComparisonRow[]): string {
  const name = site.name || site.domain;
  const missing = featureRows.filter((r) => !r.you).slice(0, 3).map((r) => r.feature);
  const parts = [
    `${name} was compared against ${competitors.length} competitor${competitors.length === 1 ? "" : "s"}: ${competitors.map((c) => c.name || c.domain).join(", ") || "none yet"}.`,
  ];
  if (missing.length) parts.push(`Notable feature gaps where rivals lead: ${missing.join(", ")}.`);
  if (gaps.length) parts.push(`${gaps.length} content gap${gaps.length === 1 ? "" : "s"} found where competitors publish and you don't.`);
  return parts.join(" ");
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function synthesizeCompetitorAnalysis(
  site: SiteProfile,
  competitors: CompetitorProfile[],
): Promise<CompetitorAnalysis> {
  const positioning = buildPositioning(site, competitors);
  const featureComparison = buildFeatureComparison(site, competitors);
  const contentGaps = buildContentGaps(site, competitors);
  const pricing = buildPricingComparison(site, competitors);

  const fallback = localSummary(site, competitors, contentGaps, featureComparison);
  const { text: summary, source } = await aiText({
    system:
      "You are a competitive strategist. Write a tight 2-3 sentence executive summary of a competitor analysis: where the company stands, its biggest gap, and its biggest opportunity. Ground every claim in the provided data; do not invent competitors or numbers.",
    messages: [
      {
        role: "user",
        content: [
          `Company: ${site.name || site.domain}`,
          `Competitors: ${competitors.map((c) => c.name || c.domain).join(", ") || "none"}`,
          `Feature gaps (rivals have, you don't): ${featureComparison.filter((r) => !r.you).map((r) => r.feature).slice(0, 6).join("; ") || "none"}`,
          `Content gaps: ${contentGaps.map((g) => g.topic).slice(0, 6).join("; ") || "none"}`,
        ].join("\n"),
      },
    ],
    fallback,
    maxTokens: 220,
  });

  return {
    generatedAt: new Date().toISOString(),
    summary,
    positioning,
    featureComparison,
    contentGaps,
    pricing,
    competitorsAnalyzed: competitors.length,
    source,
  };
}

function competitorAnalysisMarkdown(site: SiteProfile, analysis: CompetitorAnalysis): string {
  const name = site.name || site.domain;
  const lines: string[] = [`# Competitor Analysis — ${name}`, ""];

  lines.push(analysis.summary, "");

  lines.push("## Positioning", "");
  for (const p of analysis.positioning) {
    const tag = p.isYou ? " (you)" : "";
    const price = p.pricingFrom ? ` · from ${p.pricingFrom}` : "";
    lines.push(`- **${p.name}**${tag} — ${p.positioning}${price}`);
  }
  lines.push("");

  if (analysis.featureComparison.length) {
    lines.push("## Feature gaps", "");
    for (const r of analysis.featureComparison) {
      const haveIt = Object.entries(r.competitors).filter(([, v]) => v).map(([d]) => d);
      const mark = r.you ? "you have it" : "missing for you";
      lines.push(`- ${r.feature} — ${mark}${haveIt.length ? `; competitors: ${haveIt.join(", ")}` : ""}`);
    }
    lines.push("");
  }

  if (analysis.contentGaps.length) {
    lines.push("## Content gaps (competitors publish, you don't)", "");
    for (const g of analysis.contentGaps) lines.push(`- ${g.topic} — covered by ${g.coveredBy.join(", ")}`);
    lines.push("");
  }

  if (analysis.pricing.length) {
    lines.push("## Pricing", "");
    for (const row of analysis.pricing) {
      const tag = row.isYou ? " (you)" : "";
      const tiers = row.tiers.map((t) => `${t.name}${t.price ? ` ${t.price}` : ""}${t.period ? ` ${t.period}` : ""}`).join(", ");
      lines.push(`- **${row.name}**${tag}: ${tiers || "—"}`);
    }
    lines.push("");
  }

  lines.push(`_Generated ${new Date(analysis.generatedAt).toLocaleString()} · ${analysis.competitorsAnalyzed} competitor(s) analyzed · ${analysis.source === "ai" ? "AI-assisted" : "local"} synthesis._`);
  return lines.join("\n");
}

// ── Knowledge documents ──────────────────────────────────────────────────────

export function buildProductInformation(site: SiteProfile): string {
  const name = site.name || site.domain;
  const lines = [`# ${name}`, "", site.description || site.tagline || "", ""];
  if (site.valueProps.length) {
    lines.push("## Value propositions", "");
    for (const v of site.valueProps.slice(0, 6)) lines.push(`- ${v}`);
    lines.push("");
  }
  if (site.features.length) {
    lines.push("## Features", "");
    for (const f of site.features.slice(0, 16)) lines.push(`- ${f}`);
    lines.push("");
  }
  if (site.pricingTiers.length) {
    lines.push("## Pricing tiers", "");
    for (const t of site.pricingTiers) {
      lines.push(`- ${t.name}${t.price ? ` — ${t.price}${t.period ? ` ${t.period}` : ""}` : ""}`);
    }
    lines.push("");
  }
  if (site.pages.length) {
    lines.push("## Key pages", "");
    for (const p of site.pages.slice(0, 12)) lines.push(`- ${p.kind}: ${p.url}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}

export function buildLlmsTxt(site: SiteProfile): string {
  const name = site.name || site.domain;
  const lines = [`# ${name}`, "", `> ${site.description || site.tagline || `${name} — generated guidance for AI/answer engines.`}`, ""];
  lines.push("## About", `${name} (${site.url}).`, "");
  if (site.features.length) {
    lines.push("## What it does", ...site.features.slice(0, 8).map((f) => `- ${f}`), "");
  }
  lines.push("## Key pages", ...site.pages.slice(0, 10).map((p) => `- ${p.url}`), "");
  return lines.join("\n");
}

export async function synthesizeKnowledge(
  site: SiteProfile,
  competitors: CompetitorProfile[],
  opts: { category: string },
): Promise<SynthesisResult> {
  const name = site.name || site.domain;
  const analysis = await synthesizeCompetitorAnalysis(site, competitors);

  // Brand voice — grounded in real on-page copy.
  const brandFallback =
    "Confident, clear, and helpful. Speak plainly, avoid jargon, and lead with customer value.";
  const brand = await aiText({
    system:
      "You analyze brand voice from real website copy. In 3-4 sentences, describe the tone, vocabulary, and style, then give 3 dos and don'ts. Ground it in the copy provided.",
    messages: [
      {
        role: "user",
        content: [
          `Company: ${name}`,
          site.tagline && `Tagline: ${site.tagline}`,
          site.valueProps.length && `Copy samples:\n${site.valueProps.slice(0, 6).map((v) => `- ${v}`).join("\n")}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    fallback: brandFallback,
    maxTokens: 300,
  });

  // Marketing strategy — grounded in category, competitive gaps, and crawl issues.
  const issues = (site.homepage.issues ?? []).slice(0, 5).map((i) => i.title);
  const strategyFallback = [
    `Primary channels: SEO, content, and community (Reddit, Hacker News, X, LinkedIn).`,
    `Positioning: ${site.valueProps[0] || site.description || "the simplest way to get the job done"}.`,
    analysis.contentGaps.length ? `Content priorities: ${analysis.contentGaps.slice(0, 3).map((g) => g.topic).join(", ")}.` : "",
    issues.length ? `Technical priorities: ${issues.join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const strategy = await aiText({
    system:
      "You are a fractional CMO. Write a focused 30/60/90-day marketing strategy (channels, positioning, content priorities, quick technical wins). Ground it in the provided competitive and crawl data.",
    messages: [
      {
        role: "user",
        content: [
          `Company: ${name} (category: ${opts.category})`,
          `Positioning: ${site.valueProps[0] || site.description || ""}`,
          `Competitors: ${competitors.map((c) => c.name || c.domain).join(", ") || "none"}`,
          `Content gaps: ${analysis.contentGaps.map((g) => g.topic).slice(0, 6).join("; ") || "none"}`,
          `Site issues: ${issues.join("; ") || "none"}`,
        ].join("\n"),
      },
    ],
    fallback: strategyFallback,
    maxTokens: 500,
  });

  const source: "ai" | "local" =
    analysis.source === "ai" || brand.source === "ai" || strategy.source === "ai" ? "ai" : "local";

  return {
    documents: {
      productInformation: buildProductInformation(site),
      brandVoice: brand.text,
      marketingStrategy: strategy.text,
      llmsTxt: buildLlmsTxt(site),
      competitorAnalysis: competitorAnalysisMarkdown(site, analysis),
    },
    analysis,
    source,
  };
}
