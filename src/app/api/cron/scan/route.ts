import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runFullScan } from "@/lib/agents/engine";
import { env } from "@/lib/env";

export const maxDuration = 300;

/**
 * Scheduled scan for every connected project. Wire this to a cron service
 * (e.g. Vercel Cron, GitHub Actions, or `curl` from cron) hitting:
 *   GET /api/cron/scan?secret=YOUR_CRON_SECRET
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== env.cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({ select: { id: true, name: true } });
  const results: Record<string, unknown> = {};
  for (const p of projects) {
    try {
      results[p.name] = await runFullScan(p.id);
    } catch (err) {
      results[p.name] = { error: (err as Error).message };
    }
  }
  return NextResponse.json({ ok: true, scanned: projects.length, results });
}
