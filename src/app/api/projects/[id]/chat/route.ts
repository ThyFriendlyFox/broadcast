import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cmoReply } from "@/lib/cmo";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const messages = await prisma.chatMessage.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ messages });
}

const schema = z.object({ message: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "message required" }, { status: 400 });

  await prisma.chatMessage.create({ data: { projectId: id, role: "user", content: parsed.data.message } });
  const reply = await cmoReply(id, parsed.data.message);
  const saved = await prisma.chatMessage.create({ data: { projectId: id, role: "assistant", content: reply } });

  return NextResponse.json({ reply: saved });
}
