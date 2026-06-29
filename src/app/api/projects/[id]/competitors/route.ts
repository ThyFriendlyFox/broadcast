import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { domainFromUrl } from "@/lib/utils";
import { refreshCompetitorAnalysis } from "@/lib/acquisition/harness";

export const maxDuration = 120;

const schema = z.object({ domain: z.string().min(2), name: z.string().optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "domain required" }, { status: 400 });
  const competitor = await prisma.competitor.create({
    data: { projectId: id, domain: domainFromUrl(parsed.data.domain), name: parsed.data.name ?? null },
  });
  // Re-profile competitors and regenerate the analysis in the background.
  refreshCompetitorAnalysis(id).catch((err) =>
    console.warn("[competitors] refresh failed:", (err as Error).message),
  );
  return NextResponse.json({ competitor: { id: competitor.id, domain: competitor.domain } }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const competitorId = url.searchParams.get("competitorId");
  if (!competitorId) return NextResponse.json({ error: "competitorId required" }, { status: 400 });
  await prisma.competitor.delete({ where: { id: competitorId } }).catch(() => null);
  refreshCompetitorAnalysis(id).catch((err) =>
    console.warn("[competitors] refresh failed:", (err as Error).message),
  );
  return NextResponse.json({ ok: true });
}
