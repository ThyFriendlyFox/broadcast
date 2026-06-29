import { prisma } from "../prisma";
import { runPageSpeed } from "../integrations/pagespeed";
import { crawlSite } from "../integrations/crawl";
import { loadProjectContext } from "./context";
import { RUNNERS } from "./agents";
import type { AgentType } from "./registry";

/** Run analytics collection (Lighthouse + on-page crawl) and persist snapshots. */
export async function runAnalytics(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const [mobile, desktop, crawl] = await Promise.all([
    runPageSpeed(project.url, "mobile"),
    runPageSpeed(project.url, "desktop"),
    crawlSite(project.url),
  ]);

  await prisma.$transaction([
    prisma.analyticsSnapshot.create({
      data: { projectId, kind: "pagespeed", strategy: "mobile", data: JSON.stringify(mobile) },
    }),
    prisma.analyticsSnapshot.create({
      data: { projectId, kind: "pagespeed", strategy: "desktop", data: JSON.stringify(desktop) },
    }),
    prisma.analyticsSnapshot.create({
      data: { projectId, kind: "crawl", data: JSON.stringify(crawl) },
    }),
  ]);

  return { mobile, desktop, crawl };
}

/** Run a single agent: generate items, persist them, update agent state. */
export async function runAgent(projectId: string, type: AgentType) {
  await prisma.agent.upsert({
    where: { projectId_type: { projectId, type } },
    update: { status: "scanning" },
    create: { projectId, type, status: "scanning" },
  });

  try {
    const ctx = await loadProjectContext(projectId);
    const result = await RUNNERS[type](ctx);

    // Replace previous "new" items for this agent so the feed stays fresh.
    await prisma.feedItem.deleteMany({ where: { projectId, agentType: type, status: "new" } });

    if (result.items.length) {
      await prisma.feedItem.createMany({
        data: result.items.map((it) => ({
          projectId,
          agentType: type,
          kind: it.kind,
          title: it.title,
          description: it.description ?? null,
          payload: JSON.stringify(it.payload ?? {}),
          priority: it.priority ?? 2,
          url: it.url ?? null,
          status: "new",
        })),
      });
    }

    if (result.content?.length) {
      for (const c of result.content) {
        // Avoid piling up duplicate drafts: keep one latest draft per platform per agent.
        await prisma.contentPiece.deleteMany({
          where: { projectId, platform: c.platform, status: "draft" },
        });
        await prisma.contentPiece.create({
          data: {
            projectId,
            platform: c.platform,
            title: c.title ?? null,
            body: c.body,
            meta: JSON.stringify(c.meta ?? {}),
            status: c.status ?? "draft",
          },
        });
      }
    }

    await prisma.agent.update({
      where: { projectId_type: { projectId, type } },
      data: { status: "ready", summary: result.summary, lastRunAt: new Date() },
    });

    return result;
  } catch (err) {
    await prisma.agent.update({
      where: { projectId_type: { projectId, type } },
      data: { status: "error", summary: `Error: ${(err as Error).message}` },
    });
    throw err;
  }
}

/** Full scan: analytics first (SEO agent depends on the crawl), then every agent. */
export async function runFullScan(projectId: string) {
  await runAnalytics(projectId);
  const types: AgentType[] = ["seo", "articles", "reddit", "hackernews", "linkedin", "x_influencer", "ugc_videos"];
  const results: Record<string, string> = {};
  for (const type of types) {
    try {
      const r = await runAgent(projectId, type);
      results[type] = r.summary;
    } catch (err) {
      results[type] = `error: ${(err as Error).message}`;
    }
  }
  return results;
}
