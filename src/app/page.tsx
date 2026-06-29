import { prisma } from "@/lib/prisma";
import { getProjectDashboard } from "@/lib/queries";
import { features } from "@/lib/env";
import ConnectLanding from "@/components/ConnectLanding";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; new?: string }>;
}) {
  const { project: projectParam, new: isNew } = await searchParams;

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, domain: true },
  });

  const status = {
    ai: features.ai,
    aiProvider: features.aiProvider,
    xPosting: features.xPosting,
    googleOAuth: features.googleOAuth,
  };

  if (projects.length === 0 || isNew) {
    return <ConnectLanding status={status} />;
  }

  const activeId = projectParam && projects.some((p) => p.id === projectParam) ? projectParam : projects[0].id;
  const data = await getProjectDashboard(activeId);
  if (!data) return <ConnectLanding status={status} />;

  return <Dashboard initialData={data} projects={projects} status={status} />;
}
