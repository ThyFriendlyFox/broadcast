import { aiJson } from "../ai";
import { crawlSiteProfile, type PricingTier } from "./siteCrawl";

export interface CompetitorProfile {
  domain: string;
  url: string;
  name?: string;
  tagline?: string;
  description?: string;
  positioning?: string;
  audience?: string;
  valueProps: string[];
  features: string[];
  pricingTiers: PricingTier[];
  blogTopics: string[];
  reachable: boolean;
  fetchedAt: string;
}

export interface ProfileOptions {
  maxPages?: number;
  concurrency?: number;
}

/**
 * Crawl a competitor's site and assemble a structured profile. Reuses the
 * multi-page site crawler (lighter page budget) and optionally enriches the
 * positioning/audience with an LLM grounded in the crawled copy.
 */
export async function profileCompetitor(domain: string, opts: ProfileOptions = {}): Promise<CompetitorProfile> {
  const { maxPages = 5, concurrency = 2 } = opts;
  const site = await crawlSiteProfile(`https://${domain}`, { maxPages, concurrency });
  const reachable = site.homepage.ok;

  const base: CompetitorProfile = {
    domain,
    url: site.url,
    name: site.name,
    tagline: site.tagline,
    description: site.description,
    positioning: site.valueProps[0],
    audience: undefined,
    valueProps: site.valueProps,
    features: site.features,
    pricingTiers: site.pricingTiers,
    blogTopics: site.blogTopics,
    reachable,
    fetchedAt: site.fetchedAt,
  };

  if (!reachable) return base;

  // Distill a one-line positioning statement + target audience from real copy.
  const { data } = await aiJson<{ positioning: string; audience: string }>({
    system:
      "You are a competitive analyst. From a competitor's crawled marketing copy, write a one-sentence positioning statement and a short target-audience description. Return JSON {positioning, audience}. Be concrete; do not invent facts not implied by the copy.",
    prompt: [
      `Competitor: ${site.name ?? domain} (${site.url})`,
      site.description && `Description: ${site.description}`,
      site.valueProps.length && `Value props: ${site.valueProps.slice(0, 6).join(" | ")}`,
      site.features.length && `Features: ${site.features.slice(0, 12).join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n"),
    fallback: {
      positioning: site.valueProps[0] ?? site.description ?? `${site.name ?? domain} in this category.`,
      audience: "",
    },
  });

  base.positioning = data.positioning || base.positioning;
  base.audience = data.audience || undefined;
  return base;
}
