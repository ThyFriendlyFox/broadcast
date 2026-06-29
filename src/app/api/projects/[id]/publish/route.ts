import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { postTweet } from "@/lib/integrations/x";

const schema = z.object({
  platform: z.enum(["x", "linkedin", "reddit", "hackernews", "article", "ugc_video"]),
  body: z.string().min(1),
  title: z.string().optional(),
  feedItemId: z.string().optional(),
  contentId: z.string().optional(),
});

/**
 * Publish a piece of content. For X, this calls the live X API when credentials
 * are configured; otherwise it records a simulated publication so the workflow
 * is fully demonstrable without keys.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "platform and body required" }, { status: 400 });
  const { platform, title, feedItemId, contentId } = parsed.data;
  const text = parsed.data.body;

  // Upsert the content piece we're publishing.
  let piece = contentId
    ? await prisma.contentPiece.findUnique({ where: { id: contentId } })
    : null;
  if (!piece) {
    piece = await prisma.contentPiece.create({
      data: { projectId: id, platform, title: title ?? null, body: text, status: "publishing" },
    });
  } else {
    piece = await prisma.contentPiece.update({ where: { id: piece.id }, data: { status: "publishing", body: text } });
  }

  let externalUrl: string | null = null;
  let simulated = false;
  let status = "published";
  let error: string | null = null;

  try {
    if (platform === "x") {
      const result = await postTweet(text);
      if (!result.ok) throw new Error(result.error || "X publish failed");
      externalUrl = result.url ?? null;
      simulated = result.simulated;
    } else {
      // LinkedIn / Reddit / HN / article / UGC: recorded as published in the
      // outbox. Native write APIs for these require per-user OAuth apps.
      simulated = true;
    }
  } catch (err) {
    status = "failed";
    error = (err as Error).message;
  }

  piece = await prisma.contentPiece.update({
    where: { id: piece.id },
    data: {
      status,
      externalUrl,
      error,
      publishedAt: status === "published" ? new Date() : null,
      meta: JSON.stringify({ simulated }),
    },
  });

  if (feedItemId && status === "published") {
    await prisma.feedItem.update({ where: { id: feedItemId }, data: { status: "published" } }).catch(() => null);
  }

  return NextResponse.json({ ok: status === "published", simulated, externalUrl, error, piece: { id: piece.id, status: piece.status, externalUrl } });
}
