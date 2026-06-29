import { NextRequest, NextResponse } from "next/server";
import { runFullScan, runAgent } from "@/lib/agents/engine";
import { buildDailyBriefing } from "@/lib/cmo";
import { prisma } from "@/lib/prisma";
import type { AgentType } from "@/lib/agents/registry";

export const maxDuration = 120;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const agentParam = url.searchParams.get("agent") as AgentType | null;

  try {
    if (agentParam) {
      const result = await runAgent(id, agentParam);
      return NextResponse.json({ ok: true, summary: result.summary });
    }

    const results = await runFullScan(id);

    // Post a fresh CMO briefing if the conversation is empty.
    const existing = await prisma.chatMessage.count({ where: { projectId: id, role: "assistant" } });
    if (existing === 0) {
      const briefing = await buildDailyBriefing(id);
      await prisma.chatMessage.create({ data: { projectId: id, role: "assistant", content: briefing } });
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[scan] failed:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
