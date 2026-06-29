import { prisma } from "./prisma";
import { normalizeUrl, domainFromUrl } from "./utils";
import { AGENTS } from "./agents/registry";
import { crawlSiteProfile } from "./acquisition/siteCrawl";
import { buildProductInformation, buildLlmsTxt } from "./acquisition/synthesize";

/**
 * Connect a new project: do a fast multi-page crawl to seed real product info,
 * then let the acquisition harness (kicked off by the first scan) discover and
 * analyze competitors and synthesize the full knowledge base.
 */
export async function connectProject(rawUrl: string, overrides?: { name?: string; category?: string }) {
  const url = normalizeUrl(rawUrl);
  const domain = domainFromUrl(url);

  // Fast first pass: a few key pages so the dashboard has real content immediately.
  const site = await crawlSiteProfile(url, { maxPages: 4, concurrency: 3 });

  const name = overrides?.name || site.name || cap(domain.split(".")[0]);
  const category = overrides?.category || "software";
  const description = site.description || site.valueProps[0] || `${name} — a modern ${category} product.`;

  const project = await prisma.project.create({
    data: {
      name,
      url,
      domain,
      category,
      description,
      documents: {
        create: [
          { type: "product_information", title: "Product Information", content: buildProductInformation(site), status: "ready" },
          { type: "brand_voice", title: "Brand Voice", content: "Confident, clear, and helpful. Speak plainly, avoid jargon, and lead with customer value.", status: "generating" },
          { type: "competitor_analysis", title: "Competitor Analysis", content: "Discovering and analyzing competitors…", status: "generating" },
          { type: "marketing_strategy", title: "Marketing Strategy", content: `Primary channels: SEO, content, and community.\nPositioning: ${description}.`, status: "generating" },
          { type: "llms_txt", title: "llms.txt", content: buildLlmsTxt(site), status: "ready" },
          { type: "articles", title: "Articles", content: "", status: "new" },
        ],
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

  // Seed snapshots so the SEO agent + analytics panel + harness have data immediately.
  await prisma.$transaction([
    prisma.analyticsSnapshot.create({ data: { projectId: project.id, kind: "crawl", data: JSON.stringify(site.homepage) } }),
    prisma.analyticsSnapshot.create({ data: { projectId: project.id, kind: "site_profile", data: JSON.stringify(site) } }),
  ]);

  return project;
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
