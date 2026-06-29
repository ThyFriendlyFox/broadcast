import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { features } from "@/lib/env";
import { getXAccount } from "@/lib/integrations/x";

const schema = z.object({
  provider: z.enum(["google_analytics", "search_console", "x", "reddit", "linkedin", "hackernews"]),
  action: z.enum(["connect", "disconnect"]),
});

/**
 * Connect/disconnect an integration. When real credentials are configured in
 * the environment, the connection is "connected" (live); otherwise it is
 * recorded as "simulated" so the rest of the UI is exercisable.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const { provider, action } = parsed.data;

  if (action === "disconnect") {
    await prisma.integration.upsert({
      where: { projectId_provider: { projectId: id, provider } },
      update: { status: "disconnected", accountName: null },
      create: { projectId: id, provider, status: "disconnected" },
    });
    return NextResponse.json({ ok: true, status: "disconnected" });
  }

  let status = "simulated";
  let accountName: string | null = null;

  if (provider === "x") {
    const acct = await getXAccount();
    status = features.xPosting && acct.ok && !acct.simulated ? "connected" : "simulated";
    accountName = acct.username ? `@${acct.username}` : null;
  } else if ((provider === "google_analytics" || provider === "search_console") && features.googleOAuth) {
    status = "connected";
  }

  const integration = await prisma.integration.upsert({
    where: { projectId_provider: { projectId: id, provider } },
    update: { status, accountName },
    create: { projectId: id, provider, status, accountName },
  });

  return NextResponse.json({ ok: true, status: integration.status, accountName: integration.accountName });
}
