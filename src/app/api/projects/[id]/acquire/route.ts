import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAcquisition } from "@/lib/acquisition/harness";

export const maxDuration = 300;

/**
 * Run the acquisition harness on demand: multi-page site crawl, competitor
 * discovery + profiling, and knowledge-base synthesis.
 *   POST /api/projects/[id]/acquire           -> full run (discovers competitors)
 *   POST /api/projects/[id]/acquire?discover=0 -> refresh using existing competitors
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const discover = url.searchParams.get("discover") !== "0";

  try {
    const result = await runAcquisition(id, { discover });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[acquire] failed:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
