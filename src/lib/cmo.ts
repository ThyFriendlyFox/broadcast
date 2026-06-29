import { prisma } from "./prisma";
import { aiText, type ChatMsg } from "./ai";
import { loadProjectContext, contextBlock } from "./agents/context";
import { AGENT_MAP } from "./agents/registry";
import { safeJson } from "./utils";

const CMO_SYSTEM = `You are the user's full-time AI CMO (Chief Marketing Officer) inside Broadcast.
You are sharp, proactive, and concrete. You speak like a seasoned growth leader: short paragraphs, specific next steps, no fluff.
You have access to the project's brand docs, SEO audit, and a feed of marketing opportunities produced by your agents (SEO, Articles, Reddit, Hacker News, LinkedIn, X Influencer, UGC Videos).
When asked what to do, prioritize ruthlessly and reference the actual opportunities in the feed. Keep replies under 180 words unless asked for more.`;

export async function cmoReply(projectId: string, userMessage: string): Promise<string> {
  const ctx = await loadProjectContext(projectId);
  const feed = await prisma.feedItem.findMany({
    where: { projectId, status: "new" },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    take: 12,
  });
  const history = await prisma.chatMessage.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const feedSummary = feed
    .map((f) => `- [${AGENT_MAP[f.agentType as keyof typeof AGENT_MAP]?.name ?? f.agentType}] ${f.title}`)
    .join("\n");

  const messages: ChatMsg[] = [
    ...history
      .reverse()
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
      .filter((m) => m.role === "user" || m.role === "assistant"),
    {
      role: "user",
      content: `${userMessage}\n\n---\nContext for you (not shown to user):\n${contextBlock(ctx)}\n\nCurrent opportunity feed:\n${feedSummary || "(empty — run a scan)"}`,
    },
  ];

  const fallback = buildLocalReply(userMessage, ctx.name, feed);
  const { text } = await aiText({ system: CMO_SYSTEM, messages, fallback, maxTokens: 500 });
  return text;
}

function buildLocalReply(
  userMessage: string,
  projectName: string,
  feed: { title: string; agentType: string; priority: number }[],
): string {
  const q = userMessage.toLowerCase();
  const top = [...feed].sort((a, b) => a.priority - b.priority).slice(0, 4);

  if (/hello|hey|hi\b|start|brief|today|what.*do/.test(q) || !userMessage.trim()) {
    if (!top.length) {
      return `I'm your CMO for ${projectName}. I don't have fresh opportunities yet — hit "Scan now" and I'll audit your site, find Reddit/HN threads, draft articles, and line up posts for X and LinkedIn. Give me a minute and I'll come back with a prioritized plan.`;
    }
    const lines = top.map((t, i) => `${i + 1}. ${t.title} (${AGENT_MAP[t.agentType as keyof typeof AGENT_MAP]?.name ?? t.agentType})`);
    return `Here's where I'd focus for ${projectName} right now:\n\n${lines.join("\n")}\n\nWant me to publish the X post, ship a Reddit reply, or open the article draft? Just say the word.`;
  }
  if (/seo|rank|search/.test(q)) {
    const seo = feed.filter((f) => f.agentType === "seo").slice(0, 3);
    return seo.length
      ? `On SEO, I'd tackle these first:\n${seo.map((s) => `• ${s.title}`).join("\n")}\n\nFixing the high-severity items compounds fastest. Want the full audit?`
      : `I haven't audited the site yet — run a scan and I'll return prioritized SEO + technical fixes with Lighthouse scores.`;
  }
  if (/tweet|twitter|\bx\b|post/.test(q)) {
    const x = feed.find((f) => f.agentType === "x_influencer");
    return x
      ? `I've got a branded tweet drafted and ${projectName}'s influencer matches lined up. Say "publish the tweet" and I'll push it to your connected X account (or queue it if X isn't connected yet).`
      : `Run a scan and I'll draft a launch tweet plus a matched influencer shortlist for X.`;
  }
  if (/article|content|blog/.test(q)) {
    const art = feed.find((f) => f.agentType === "articles");
    return art
      ? `Top content bet: "${art.title}". I've written a full draft you can open and publish. Want me to spin up the next two topics into a calendar?`
      : `Run a scan and I'll build a keyword-driven content calendar with a ready-to-publish first draft.`;
  }
  return `Got it. For ${projectName}, my agents are tracking ${feed.length} live opportunities. The highest-leverage move right now is "${top[0]?.title ?? "running a fresh scan"}". Want me to action it?`;
}

export async function buildDailyBriefing(projectId: string): Promise<string> {
  const ctx = await loadProjectContext(projectId);
  const feed = await prisma.feedItem.findMany({
    where: { projectId, status: "new" },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  });
  const byAgent = (t: string) => feed.filter((f) => f.agentType === t);

  const lines: string[] = [`hi, i'm your cmo. thanks for bringing me on.`, ``, `here's what i've got for ${ctx.name} today:`, ``];

  const seo = byAgent("seo").length;
  const articles = byAgent("articles").length;
  const reddit = byAgent("reddit").length;
  const x = byAgent("x_influencer").length;
  const linkedin = byAgent("linkedin").length;

  if (seo) lines.push(`• ${seo} seo / geo issues to fix`);
  if (articles) lines.push(`• ${articles} article topic${articles === 1 ? "" : "s"} (1 drafted)`);
  if (reddit) lines.push(`• ${reddit} reddit opportunities`);
  if (x) lines.push(`• 1 tweet + influencer shortlist`);
  if (linkedin) lines.push(`• 1 linkedin post`);
  if (!feed.length) lines.push(`• nothing yet — hit "scan now" and i'll get to work`);

  lines.push(``, `tell me what to ship first, or i'll start working down the list.`, ``, `let's grow. 🚀`);
  return lines.join("\n");
}

export function projectDocsContext(projectId: string) {
  return loadProjectContext(projectId);
}

export { safeJson };
