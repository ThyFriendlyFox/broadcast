import { aiJson } from "../ai";
import { searchHackerNews, searchReddit } from "../integrations/discovery";
import { seededRandom, pick } from "../utils";
import type { AgentType } from "./registry";
import { contextBlock, type ProjectContext } from "./context";

export interface NewFeedItem {
  kind: string;
  title: string;
  description?: string;
  payload?: any;
  priority?: number;
  url?: string;
}

export interface NewContentPiece {
  platform: string;
  title?: string;
  body: string;
  meta?: any;
  status?: string;
}

export interface AgentRunResult {
  summary: string;
  items: NewFeedItem[];
  content?: NewContentPiece[];
  source: "ai" | "local";
}

type Runner = (ctx: ProjectContext) => Promise<AgentRunResult>;

// ── SEO Agent ────────────────────────────────────────────────────────────────
const runSeo: Runner = async (ctx) => {
  const issues = ctx.crawl?.issues ?? [];
  const items: NewFeedItem[] = issues
    .sort((a, b) => sev(a.severity) - sev(b.severity))
    .slice(0, 6)
    .map((iss) => ({
      kind: "fix",
      title: iss.title,
      description: iss.detail,
      priority: iss.severity === "high" ? 1 : iss.severity === "medium" ? 2 : 3,
      payload: { area: iss.area, severity: iss.severity, issueId: iss.id },
    }));

  // Add AI-enriched strategic recommendations on top of mechanical fixes.
  const fallback = {
    recommendations: [
      {
        title: `Target "${ctx.keywords[1] ?? ctx.category} for teams" as a money keyword`,
        detail: `Build a dedicated landing page optimized for high-intent ${ctx.category} searches and interlink it from your homepage.`,
      },
      {
        title: "Add FAQ schema to key pages",
        detail: "Structured FAQ markup wins SERP real estate and feeds answer engines.",
      },
    ],
  };
  const { data, source } = await aiJson<typeof fallback>({
    system:
      "You are a senior technical SEO. Return JSON {recommendations:[{title,detail}]} with 2-3 high-leverage, specific recommendations.",
    prompt: `${contextBlock(ctx)}\n\nCrawl signals: ${JSON.stringify({
      title: ctx.crawl?.title,
      h1Count: ctx.crawl?.h1Count,
      hasSchema: ctx.crawl?.hasStructuredData,
      wordCount: ctx.crawl?.wordCount,
    })}`,
    fallback,
  });
  for (const r of data.recommendations.slice(0, 3)) {
    items.push({ kind: "recommendation", title: r.title, description: r.detail, priority: 2, payload: { area: "seo" } });
  }

  const high = items.filter((i) => i.priority === 1).length;
  const summary = items.length
    ? `${items.length} recommendations ready${high ? `; ${high} high-priority` : ""}`
    : "No issues found — site looks healthy";
  return { summary, items, source };
};

// ── Articles Agent ───────────────────────────────────────────────────────────
const runArticles: Runner = async (ctx) => {
  const fallback = {
    topics: [
      {
        title: `The complete guide to ${ctx.category} in 2026`,
        angle: `A definitive, example-rich guide that targets top-of-funnel ${ctx.category} searches.`,
        keyword: `${ctx.category} guide`,
        outline: ["Why it matters now", "Core concepts", "Step-by-step workflow", `How ${ctx.name} helps`, "FAQs"],
      },
      {
        title: `${ctx.name} vs ${ctx.competitors[0] ?? "the alternatives"}: an honest comparison`,
        angle: "High-intent comparison content that captures bottom-of-funnel demand.",
        keyword: `${ctx.name} alternatives`,
        outline: ["The short answer", "Feature comparison", "Pricing", "Who each is for"],
      },
    ],
  };
  const { data, source } = await aiJson<typeof fallback>({
    system:
      "You are an SEO content strategist. Return JSON {topics:[{title,angle,keyword,outline:[...]}]} with 2-3 ranked article ideas tied to search demand.",
    prompt: contextBlock(ctx),
    fallback,
  });

  const top = data.topics[0];
  const draft = buildArticleDraft(ctx, top);
  const items: NewFeedItem[] = data.topics.slice(0, 3).map((t, i) => ({
    kind: "topic",
    title: t.title,
    description: t.angle,
    priority: i === 0 ? 1 : 2,
    payload: { keyword: t.keyword, outline: t.outline, draft: i === 0 ? draft : undefined },
  }));

  return {
    summary: `${data.topics.length} topic${data.topics.length === 1 ? "" : "s"} ready`,
    items,
    content: [{ platform: "article", title: top.title, body: draft, meta: { keyword: top.keyword }, status: "draft" }],
    source,
  };
};

function buildArticleDraft(ctx: ProjectContext, topic: { title: string; outline: string[] }): string {
  const lines = [
    `# ${topic.title}`,
    "",
    `${ctx.name} helps teams with ${ctx.category}. In this guide we break down everything you need to know.`,
    "",
  ];
  for (const h of topic.outline) {
    lines.push(`## ${h}`, "", `Detailed, practical guidance on "${h.toLowerCase()}" for ${ctx.category} teams.`, "");
  }
  lines.push("## Get started", "", `Ready to move faster? [Try ${ctx.name}](${ctx.url}).`);
  return lines.join("\n");
}

// ── Reddit Agent ─────────────────────────────────────────────────────────────
const runReddit: Runner = async (ctx) => {
  const query = `${ctx.category} ${ctx.keywords[1] ?? ""}`.trim();
  const opps = await searchReddit(query);
  const items: NewFeedItem[] = [];

  for (const o of opps.slice(0, 4)) {
    const reply = `Genuinely useful here: I've been using ${ctx.name} for ${ctx.category} and it solved exactly this. Happy to share how we set it up — no affiliation pitch, just what worked.`;
    items.push({
      kind: "opportunity",
      title: o.title,
      description: `${o.source} · ${o.context ?? ""}`,
      url: o.url,
      priority: (o.score ?? 0) > 100 ? 1 : 2,
      payload: { source: o.source, suggestedReply: reply },
    });
  }
  return {
    summary: items.length ? `${items.length} opportunities ready` : "No new threads found",
    items,
    source: "local",
  };
};

// ── Hacker News Agent ────────────────────────────────────────────────────────
const runHackerNews: Runner = async (ctx) => {
  const opps = await searchHackerNews(ctx.category);
  const fallback = {
    title: `Show HN: ${ctx.name} – ${ctx.description || ctx.category}`,
    body: `I built ${ctx.name} to fix ${ctx.category} pain I kept hitting. It does X, Y, Z. Tech stack and lessons below — feedback very welcome.`,
  };
  const { data, source } = await aiJson<typeof fallback>({
    system:
      "You are a founder writing a Show HN post. Return JSON {title,body}. Title <= 80 chars, body 3-5 sentences, authentic and technical, no marketing fluff.",
    prompt: contextBlock(ctx),
    fallback,
  });

  const items: NewFeedItem[] = [
    {
      kind: "post",
      title: data.title,
      description: data.body,
      priority: 1,
      payload: { platform: "hackernews", body: data.body },
    },
  ];
  for (const o of opps.slice(0, 2)) {
    items.push({
      kind: "opportunity",
      title: `Comment on: ${o.title}`,
      description: o.context,
      url: o.url,
      priority: 3,
      payload: { source: "Hacker News" },
    });
  }
  return {
    summary: "1 post ready",
    items,
    content: [{ platform: "hackernews", title: data.title, body: data.body, status: "draft" }],
    source,
  };
};

// ── LinkedIn Agent ───────────────────────────────────────────────────────────
const runLinkedIn: Runner = async (ctx) => {
  const fallback = {
    post: `Most ${ctx.category} teams are stuck doing things the slow way.\n\nWe built ${ctx.name} because we were too.\n\nHere's what changed for us:\n• Less busywork\n• Faster cycles\n• Happier team\n\nIf you're wrestling with ${ctx.category}, I'd love to hear how you're approaching it. 👇`,
  };
  const { data, source } = await aiJson<typeof fallback>({
    system:
      "You are a B2B founder writing a LinkedIn post. Return JSON {post}. Strong hook, short lines, a personal insight, and a soft CTA. No hashtags spam.",
    prompt: contextBlock(ctx),
    fallback,
  });
  return {
    summary: "1 post ready",
    items: [{ kind: "post", title: "LinkedIn post draft", description: data.post.slice(0, 140), priority: 2, payload: { platform: "linkedin", body: data.post } }],
    content: [{ platform: "linkedin", body: data.post, status: "draft" }],
    source,
  };
};

// ── X Influencer Agent ───────────────────────────────────────────────────────
const runXInfluencer: Runner = async (ctx) => {
  const rng = seededRandom(`x:${ctx.id}`);
  const niches = ["build-in-public", "devtools", "indie hackers", "B2B SaaS", "growth", ctx.category];
  const handles = ["@foundervibes", "@buildlogs", "@devtoolsdaily", "@saasgrowth", "@indiehacker", "@techreviews"];
  const influencers = [0, 1, 2, 3].map(() => ({
    handle: pick(handles, rng),
    niche: pick(niches, rng),
    followers: 5000 + Math.floor(rng() * 120000),
    fit: Math.round(70 + rng() * 29),
  }));

  const fallback = {
    tweet: `We just shipped something for ${ctx.category} folks 👀\n\n${ctx.name} → ${ctx.description || "the fastest way to get it done"}.\n\n${ctx.url}`,
    outreach: `Hey {{handle}} — love your ${"{{niche}}"} content. Built ${ctx.name} for ${ctx.category} and think your audience would dig it. Open to a quick look?`,
  };
  const { data, source } = await aiJson<typeof fallback>({
    system:
      "You write X (Twitter) marketing copy. Return JSON {tweet,outreach}. Tweet <= 270 chars with a hook; outreach is a short influencer DM template with {{handle}} and {{niche}} placeholders.",
    prompt: contextBlock(ctx),
    fallback,
  });

  return {
    summary: `${influencers.length} influencer matches + tweet ready`,
    items: [
      {
        kind: "campaign",
        title: "Launch influencer campaign",
        description: `${influencers.length} matched creators · branded tweet drafted`,
        priority: 1,
        payload: { influencers, tweet: data.tweet, outreach: data.outreach },
      },
      {
        kind: "post",
        title: "Branded tweet ready to publish",
        description: data.tweet,
        priority: 1,
        payload: { platform: "x", body: data.tweet },
      },
    ],
    content: [{ platform: "x", body: data.tweet, status: "draft", meta: { kind: "branded" } }],
    source,
  };
};

// ── UGC Videos Agent ─────────────────────────────────────────────────────────
const runUgc: Runner = async (ctx) => {
  const fallback = {
    hook: `POV: you finally stopped doing ${ctx.category} the hard way`,
    script: [
      { shot: "Hook (0-3s)", line: `"Okay so I was today years old when I learned about ${ctx.name}..."` },
      { shot: "Problem (3-8s)", line: `Show the old, painful ${ctx.category} workflow.` },
      { shot: "Reveal (8-18s)", line: `Demo ${ctx.name} solving it in seconds.` },
      { shot: "CTA (18-25s)", line: `"Link in bio — it's a game changer." (${ctx.url})` },
    ],
  };
  const { data, source } = await aiJson<typeof fallback>({
    system:
      "You are a UGC short-form video creator. Return JSON {hook, script:[{shot,line}]} for a 25-30s vertical video (hook, problem, reveal, CTA).",
    prompt: contextBlock(ctx),
    fallback,
  });
  const body = `HOOK: ${data.hook}\n\n` + data.script.map((s) => `${s.shot}\n${s.line}`).join("\n\n");
  return {
    summary: "1 video ready",
    items: [{ kind: "post", title: `UGC video: ${data.hook}`, description: "Script + shot list ready", priority: 2, payload: { platform: "ugc_video", body, hook: data.hook, script: data.script } }],
    content: [{ platform: "ugc_video", title: data.hook, body, status: "draft" }],
    source,
  };
};

function sev(s: string): number {
  return s === "high" ? 0 : s === "medium" ? 1 : 2;
}

export const RUNNERS: Record<AgentType, Runner> = {
  seo: runSeo,
  articles: runArticles,
  reddit: runReddit,
  hackernews: runHackerNews,
  linkedin: runLinkedIn,
  x_influencer: runXInfluencer,
  ugc_videos: runUgc,
};
