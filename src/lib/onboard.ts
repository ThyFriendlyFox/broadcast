import { prisma } from "./prisma";
import { aiJson } from "./ai";
import { crawlSite } from "./integrations/crawl";
import { normalizeUrl, domainFromUrl } from "./utils";
import { AGENTS } from "./agents/registry";

interface InferredProfile {
  name: string;
  category: string;
  description: string;
  productInformation: string;
  brandVoice: string;
  marketingStrategy: string;
  competitorAnalysis: string;
  competitors: string[];
}

/**
 * Connect a new project: crawl the site, infer a company profile with AI
 * (graceful local fallback), and seed documents, competitors, integrations,
 * and the default agent roster.
 */
export async function connectProject(rawUrl: string, overrides?: { name?: string; category?: string }) {
  const url = normalizeUrl(rawUrl);
  const domain = domainFromUrl(url);

  const crawl = await crawlSite(url);
  const siteText = [crawl.title, crawl.metaDescription, ...crawl.h1s].filter(Boolean).join(" — ");

  const guessedName = overrides?.name || crawl.title?.split(/[|\-–—:]/)[0]?.trim() || domain.split(".")[0];
  const fallback: InferredProfile = {
    name: cap(guessedName),
    category: overrides?.category || "software",
    description: crawl.metaDescription || `${cap(guessedName)} — ${siteText || "a modern software product."}`,
    productInformation: `${cap(guessedName)} (${url})\n\n${crawl.metaDescription || ""}\n\nKey pages and headings:\n${crawl.h1s.map((h) => `- ${h}`).join("\n") || "- (none detected)"}`,
    brandVoice: "Confident, clear, and helpful. Speak plainly, avoid jargon, and lead with customer value.",
    marketingStrategy: `Primary channels: SEO, content, and community (Reddit, Hacker News, X, LinkedIn).\nPositioning: ${crawl.metaDescription || "the simplest way to get the job done"}.\nFocus the first 30 days on technical SEO fixes, 2 cornerstone articles, and a build-in-public X presence.`,
    competitorAnalysis: "Add competitors to generate a positioning matrix and content gap analysis.",
    competitors: [],
  };

  const { data: profile } = await aiJson<InferredProfile>({
    system:
      "You are a brand strategist. Given a website's crawl data, infer a company profile. Return JSON with keys: name, category, description, productInformation, brandVoice, marketingStrategy, competitorAnalysis, competitors (array of likely competitor domains). Be specific and useful.",
    prompt: `URL: ${url}\nTitle: ${crawl.title}\nDescription: ${crawl.metaDescription}\nHeadings: ${crawl.h1s.join(" | ")}\nWord count: ${crawl.wordCount}`,
    fallback,
  });

  const name = overrides?.name || profile.name || fallback.name;
  const category = overrides?.category || profile.category || fallback.category;

  const project = await prisma.project.create({
    data: {
      name,
      url,
      domain,
      category,
      description: profile.description || fallback.description,
      documents: {
        create: [
          { type: "product_information", title: "Product Information", content: profile.productInformation || fallback.productInformation, status: "ready" },
          { type: "brand_voice", title: "Brand Voice", content: profile.brandVoice || fallback.brandVoice, status: "ready" },
          { type: "competitor_analysis", title: "Competitor Analysis", content: profile.competitorAnalysis || fallback.competitorAnalysis, status: "new" },
          { type: "marketing_strategy", title: "Marketing Strategy", content: profile.marketingStrategy || fallback.marketingStrategy, status: "ready" },
          { type: "llms_txt", title: "llms.txt", content: buildLlmsTxt(name, url, profile.description || fallback.description), status: "ready" },
          { type: "articles", title: "Articles", content: "", status: "new" },
        ],
      },
      competitors: {
        create: (profile.competitors || []).slice(0, 6).map((c) => ({ domain: domainFromUrl(c) })),
      },
      agents: {
        create: AGENTS.map((a) => ({ type: a.type, summary: a.defaultSummary, status: "idle" })),
      },
      integrations: {
        create: [
          { provider: "google_analytics", status: "disconnected" },
          { provider: "search_console", status: "disconnected" },
          { provider: "x", status: "disconnected" },
          { provider: "reddit", status: "disconnected" },
          { provider: "linkedin", status: "disconnected" },
        ],
      },
    },
  });

  // Store the initial crawl so the SEO agent and analytics panel have data immediately.
  await prisma.analyticsSnapshot.create({
    data: { projectId: project.id, kind: "crawl", data: JSON.stringify(crawl) },
  });

  return project;
}

function buildLlmsTxt(name: string, url: string, description: string): string {
  return `# ${name}\n\n> ${description}\n\n## About\n${name} (${url}) — generated guidance for AI/answer engines.\n\n## Key pages\n- ${url}\n\n## Contact\n- Website: ${url}\n`;
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
