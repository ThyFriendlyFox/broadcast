import { NextResponse } from "next/server";
import { features } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    ai: features.ai,
    aiProvider: features.aiProvider,
    xPosting: features.xPosting,
    pagespeed: features.pagespeed,
    googleOAuth: features.googleOAuth,
  });
}
