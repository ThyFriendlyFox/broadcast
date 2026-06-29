import { prisma } from "../prisma";
import { crawlSiteProfile } from "./siteCrawl";
import { discoverCompetitors } from "./discover";
import { profileCompetitor, type CompetitorProfile } from "./competitor";
import { synthesizeKnowledge } from "./synthesize";

export interface AcquisitionOptions {
  /** Auto-discover competitors when the project has fewer than the cap. */
  discover?: boolean;
  /** Maximum number of competitors to keep + profile. */
  maxCompetitors?: number;
  /** Mark synthesized docs as "generating" while the harness runs. */
  markGenerating?: boolean;
}

export interface AcquisitionResult {
  competitorsAnalyzed: number;
  discovered: number;
  source: "ai" | "local";
}

const SYNTH_DOC_TYPES = [
  "product_information",
  "brand_voice",
  "marketing_strategy",
  "llms_txt",
  "competitor_analysis",
];

async function upsertDoc(projectId: string, type: string, title: string, content: string) {
  const updated = await prisma.document.updateMany({
    where: { projectId, type },
    data: { content, status: "ready" },
  });
  if (updated.count === 0) {
    await prisma.document.create({ data: { projectId, type, title, content, status: "ready" } });
  }
}

/**
 * The acquisition harness. Crawls the project's site across key pages,
 * (optionally) discovers competitors, crawls + profiles each competitor, then
 * synthesizes the full knowledge base including a grounded competitor analysis.
 *
 * Raw evidence is persisted as AnalyticsSnapshot rows (kinds: site_profile,
 * competitor_profile, competitor_analysis) and readable docs are written to the
 * project's Document rows. No schema migration required.
 */
export async function runAcquisition(projectId: string, opts: AcquisitionOptions = {}): Promise<AcquisitionResult> {
  const { discover = true, maxCompetitors = 5, markGenerating = true } = opts;

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { competitors: true },
  });
  const category = project.category || "software";

  if (markGenerating) {
    await prisma.document.updateMany({
      where: { projectId, type: { in: SYNTH_DOC_TYPES } },
      data: { status: "generating" },
    });
  }

  try {
    // 1. Crawl our own site across its key pages.
    const site = await crawlSiteProfile(project.url, { maxPages: 10, concurrency: 3 });
    await prisma.analyticsSnapshot.create({
      data: { projectId, kind: "site_profile", data: JSON.stringify(site) },
    });

    // 2. Discover competitors to fill out the roster (never overwrites user-added).
    let discovered = 0;
    const existingDomains = new Set(project.competitors.map((c) => c.domain));
    if (discover && existingDomains.size < maxCompetitors) {
      const candidates = await discoverCompetitors(site, { category, max: maxCompetitors });
      for (const cand of candidates) {
        if (existingDomains.size >= maxCompetitors) break;
        if (existingDomains.has(cand.domain)) continue;
        await prisma.competitor.create({ data: { projectId, domain: cand.domain } });
        existingDomains.add(cand.domain);
        discovered++;
      }
    }

    // 3. Crawl + profile each competitor (sequential to bound outbound load).
    const competitors = await prisma.competitor.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      take: maxCompetitors,
    });
    const profiles: CompetitorProfile[] = [];
    for (const c of competitors) {
      try {
        const profile = await profileCompetitor(c.domain, { maxPages: 4, concurrency: 2 });
        profiles.push(profile);
        await prisma.analyticsSnapshot.create({
          data: { projectId, kind: "competitor_profile", data: JSON.stringify(profile) },
        });
        await prisma.competitor.update({
          where: { id: c.id },
          data: { name: profile.name ?? c.name, notes: profile.positioning ?? c.notes },
        });
      } catch (err) {
        console.warn(`[acquire] competitor profile failed for ${c.domain}:`, (err as Error).message);
      }
    }

    // 4. Synthesize the knowledge base + structured competitor analysis.
    const synth = await synthesizeKnowledge(site, profiles, { category });
    await prisma.analyticsSnapshot.create({
      data: { projectId, kind: "competitor_analysis", data: JSON.stringify(synth.analysis) },
    });

    await Promise.all([
      upsertDoc(projectId, "product_information", "Product Information", synth.documents.productInformation),
      upsertDoc(projectId, "brand_voice", "Brand Voice", synth.documents.brandVoice),
      upsertDoc(projectId, "marketing_strategy", "Marketing Strategy", synth.documents.marketingStrategy),
      upsertDoc(projectId, "llms_txt", "llms.txt", synth.documents.llmsTxt),
      upsertDoc(projectId, "competitor_analysis", "Competitor Analysis", synth.documents.competitorAnalysis),
    ]);

    if (!project.description && site.description) {
      await prisma.project.update({ where: { id: projectId }, data: { description: site.description } });
    }

    return { competitorsAnalyzed: profiles.length, discovered, source: synth.source };
  } catch (err) {
    // Don't leave docs stuck in "generating" if the run fails.
    await prisma.document.updateMany({
      where: { projectId, type: { in: SYNTH_DOC_TYPES }, status: "generating" },
      data: { status: "ready" },
    });
    throw err;
  }
}

/**
 * Re-profile competitors and re-synthesize the competitor analysis only.
 * Used when a competitor is added/removed in the UI (skips full site re-crawl
 * when a recent site profile exists).
 */
export async function refreshCompetitorAnalysis(projectId: string, maxCompetitors = 6): Promise<AcquisitionResult> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const category = project.category || "software";

  const snap = await prisma.analyticsSnapshot.findFirst({
    where: { projectId, kind: "site_profile" },
    orderBy: { createdAt: "desc" },
  });
  const site = snap
    ? JSON.parse(snap.data)
    : await crawlSiteProfile(project.url, { maxPages: 8, concurrency: 3 });

  await prisma.document.updateMany({
    where: { projectId, type: "competitor_analysis" },
    data: { status: "generating" },
  });

  try {
    const competitors = await prisma.competitor.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      take: maxCompetitors,
    });
    const profiles: CompetitorProfile[] = [];
    for (const c of competitors) {
      try {
        const profile = await profileCompetitor(c.domain, { maxPages: 4, concurrency: 2 });
        profiles.push(profile);
        await prisma.analyticsSnapshot.create({
          data: { projectId, kind: "competitor_profile", data: JSON.stringify(profile) },
        });
        await prisma.competitor.update({
          where: { id: c.id },
          data: { name: profile.name ?? c.name, notes: profile.positioning ?? c.notes },
        });
      } catch (err) {
        console.warn(`[acquire] competitor profile failed for ${c.domain}:`, (err as Error).message);
      }
    }

    const synth = await synthesizeKnowledge(site, profiles, { category });
    await prisma.analyticsSnapshot.create({
      data: { projectId, kind: "competitor_analysis", data: JSON.stringify(synth.analysis) },
    });
    await upsertDoc(projectId, "competitor_analysis", "Competitor Analysis", synth.documents.competitorAnalysis);

    return { competitorsAnalyzed: profiles.length, discovered: 0, source: synth.source };
  } catch (err) {
    await prisma.document.updateMany({
      where: { projectId, type: "competitor_analysis", status: "generating" },
      data: { status: "ready" },
    });
    throw err;
  }
}
