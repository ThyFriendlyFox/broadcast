import { NextRequest, NextResponse } from "next/server";
import { runAnalytics } from "@/lib/agents/engine";
import { prisma } from "@/lib/prisma";

export const maxDuration = 120;

// Re-run Lighthouse + crawl and persist fresh snapshots.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const result = await runAnalytics(id);
    return NextResponse.json({ ok: true, mobile: result.mobile, desktop: result.desktop, crawl: result.crawl });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
