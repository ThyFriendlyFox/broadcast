import { prisma } from "../prisma";
import { safeJson } from "../utils";
import type { CrawlResult } from "../integrations/crawl";

export interface CompetitorContext {
  domain: string;
  name?: string;
  positioning?: string;
}

export interface ProjectContext {
  id: string;
  name: string;
  url: string;
  domain: string;
  category: string;
  description: string;
  brandVoice: string;
  productInfo: string;
  marketingStrategy: string;
  competitors: string[];
  competitorProfiles: CompetitorContext[];
  competitorAnalysis: string;
  crawl?: CrawlResult;
  keywords: string[];
}

export async function loadProjectContext(projectId: string): Promise<ProjectContext> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { documents: true, competitors: true },
  });

  const doc = (type: string) =>
    project.documents.find((d) => d.type === type)?.content?.trim() || "";

  const latestCrawl = await prisma.analyticsSnapshot.findFirst({
    where: { projectId, kind: "crawl" },
    orderBy: { createdAt: "desc" },
  });

  const category = project.category || "software";
  const description = project.description || "";
  const baseKeywords = [
    project.name.toLowerCase(),
    category.toLowerCase(),
    ...description
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 4),
  ];

  return {
    id: project.id,
    name: project.name,
    url: project.url,
    domain: project.domain,
    category,
    description,
    brandVoice: doc("brand_voice"),
    productInfo: doc("product_information"),
    marketingStrategy: doc("marketing_strategy"),
    competitors: project.competitors.map((c) => c.domain),
    competitorProfiles: project.competitors.map((c) => ({
      domain: c.domain,
      name: c.name ?? undefined,
      positioning: c.notes ?? undefined,
    })),
    competitorAnalysis: doc("competitor_analysis"),
    crawl: latestCrawl ? safeJson<CrawlResult>(latestCrawl.data, undefined as any) : undefined,
    keywords: [...new Set(baseKeywords)].slice(0, 8),
  };
}

export function contextBlock(ctx: ProjectContext): string {
  const competitorLines = ctx.competitorProfiles
    .filter((c) => c.positioning)
    .map((c) => `  - ${c.name || c.domain}: ${c.positioning}`)
    .join("\n");
  return [
    `Product: ${ctx.name} (${ctx.url})`,
    `Category: ${ctx.category}`,
    ctx.description && `Description: ${ctx.description}`,
    ctx.productInfo && `Product info: ${ctx.productInfo.slice(0, 800)}`,
    ctx.brandVoice && `Brand voice: ${ctx.brandVoice.slice(0, 500)}`,
    ctx.competitors.length && `Competitors: ${ctx.competitors.join(", ")}`,
    competitorLines && `Competitor positioning:\n${competitorLines}`,
  ]
    .filter(Boolean)
    .join("\n");
}
