import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { connectProject } from "@/lib/onboard";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, url: true, domain: true, category: true, createdAt: true },
  });
  return NextResponse.json({ projects });
}

const connectSchema = z.object({
  url: z.string().min(3),
  name: z.string().optional(),
  category: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  try {
    const project = await connectProject(parsed.data.url, {
      name: parsed.data.name,
      category: parsed.data.category,
    });
    return NextResponse.json({ project: { id: project.id, name: project.name } }, { status: 201 });
  } catch (err) {
    console.error("[connect] failed:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
