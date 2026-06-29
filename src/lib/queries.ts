import { prisma } from "./prisma";
import { safeJson } from "./utils";
import type { PageSpeedResult } from "./integrations/pagespeed";
import type { CrawlResult } from "./integrations/crawl";

export async function getProjectDashboard(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      documents: { orderBy: { createdAt: "asc" } },
      competitors: { orderBy: { createdAt: "asc" } },
      integrations: true,
      agents: true,
      campaigns: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!project) return null;

  const feed = await prisma.feedItem.findMany({
    where: { projectId, status: { in: ["new", "actioned"] } },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  });

  const content = await prisma.contentPiece.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const messages = await prisma.chatMessage.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });

  const [mobileSnap, desktopSnap, crawlSnap] = await Promise.all([
    prisma.analyticsSnapshot.findFirst({ where: { projectId, kind: "pagespeed", strategy: "mobile" }, orderBy: { createdAt: "desc" } }),
    prisma.analyticsSnapshot.findFirst({ where: { projectId, kind: "pagespeed", strategy: "desktop" }, orderBy: { createdAt: "desc" } }),
    prisma.analyticsSnapshot.findFirst({ where: { projectId, kind: "crawl" }, orderBy: { createdAt: "desc" } }),
  ]);

  return {
    project: {
      id: project.id,
      name: project.name,
      url: project.url,
      domain: project.domain,
      category: project.category,
      size: project.size,
      description: project.description,
      brandColor: project.brandColor,
      createdAt: project.createdAt,
    },
    documents: project.documents.map((d) => ({ id: d.id, type: d.type, title: d.title, content: d.content, status: d.status })),
    competitors: project.competitors.map((c) => ({ id: c.id, domain: c.domain, name: c.name })),
    integrations: project.integrations.map((i) => ({ id: i.id, provider: i.provider, status: i.status, accountName: i.accountName })),
    agents: project.agents.map((a) => ({ type: a.type, status: a.status, summary: a.summary, enabled: a.enabled, lastRunAt: a.lastRunAt })),
    campaigns: project.campaigns.map((c) => ({ id: c.id, type: c.type, name: c.name, status: c.status, data: safeJson(c.data, {}) })),
    feed: feed.map((f) => ({
      id: f.id,
      agentType: f.agentType,
      kind: f.kind,
      title: f.title,
      description: f.description,
      payload: safeJson(f.payload, {}),
      priority: f.priority,
      status: f.status,
      url: f.url,
      createdAt: f.createdAt,
    })),
    content: content.map((c) => ({
      id: c.id,
      platform: c.platform,
      title: c.title,
      body: c.body,
      meta: safeJson(c.meta, {}),
      status: c.status,
      externalUrl: c.externalUrl,
      publishedAt: c.publishedAt,
      error: c.error,
      createdAt: c.createdAt,
    })),
    messages: messages.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt })),
    analytics: {
      mobile: mobileSnap ? safeJson<PageSpeedResult>(mobileSnap.data, null as any) : null,
      desktop: desktopSnap ? safeJson<PageSpeedResult>(desktopSnap.data, null as any) : null,
      crawl: crawlSnap ? safeJson<CrawlResult>(crawlSnap.data, null as any) : null,
    },
  };
}

export type ProjectDashboard = NonNullable<Awaited<ReturnType<typeof getProjectDashboard>>>;
