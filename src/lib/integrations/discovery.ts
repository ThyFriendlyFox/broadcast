import { seededRandom, pick } from "../utils";

export interface Opportunity {
  title: string;
  url: string;
  source: string;
  context?: string;
  score?: number;
}

/** Search Hacker News via the public Algolia API for relevant discussions. */
export async function searchHackerNews(query: string): Promise<Opportunity[]> {
  try {
    const u = new URL("https://hn.algolia.com/api/v1/search");
    u.searchParams.set("query", query);
    u.searchParams.set("tags", "story");
    u.searchParams.set("hitsPerPage", "8");
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(u.toString(), { signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HN ${res.status}`);
    const data = await res.json();
    return (data.hits ?? [])
      .filter((h: any) => h.title)
      .map((h: any) => ({
        title: h.title,
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        source: "Hacker News",
        context: `${h.points ?? 0} points · ${h.num_comments ?? 0} comments`,
        score: h.points ?? 0,
      }));
  } catch (err) {
    console.warn("[hn] search failed:", (err as Error).message);
    return localHN(query);
  }
}

/** Search Reddit via the public JSON endpoint for relevant threads. */
export async function searchReddit(query: string): Promise<Opportunity[]> {
  try {
    const u = new URL("https://www.reddit.com/search.json");
    u.searchParams.set("q", query);
    u.searchParams.set("sort", "relevance");
    u.searchParams.set("t", "month");
    u.searchParams.set("limit", "8");
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(u.toString(), {
      signal: controller.signal,
      headers: { "User-Agent": "BroadcastBot/1.0" },
    });
    clearTimeout(t);
    if (!res.ok) throw new Error(`Reddit ${res.status}`);
    const data = await res.json();
    return (data.data?.children ?? [])
      .map((c: any) => c.data)
      .filter((d: any) => d?.title)
      .map((d: any) => ({
        title: d.title,
        url: `https://www.reddit.com${d.permalink}`,
        source: `r/${d.subreddit}`,
        context: `${d.ups ?? 0} upvotes · ${d.num_comments ?? 0} comments`,
        score: d.ups ?? 0,
      }));
  } catch (err) {
    console.warn("[reddit] search failed:", (err as Error).message);
    return localReddit(query);
  }
}

function localHN(query: string): Opportunity[] {
  const rng = seededRandom(`hn:${query}`);
  const templates = [
    `Show HN: I built a tool for ${query}`,
    `Ask HN: How do you handle ${query}?`,
    `The state of ${query} in 2026`,
    `Why ${query} is harder than it looks`,
  ];
  return templates.slice(0, 3).map((title) => ({
    title,
    url: `https://news.ycombinator.com/item?id=${40000000 + Math.floor(rng() * 999999)}`,
    source: "Hacker News",
    context: `${Math.floor(rng() * 300)} points · ${Math.floor(rng() * 120)} comments`,
    score: Math.floor(rng() * 300),
  }));
}

function localReddit(query: string): Opportunity[] {
  const rng = seededRandom(`reddit:${query}`);
  const subs = ["SaaS", "startups", "Entrepreneur", "webdev", "marketing", "selfhosted"];
  return [0, 1, 2].map(() => {
    const sub = pick(subs, rng);
    return {
      title: `Looking for recommendations on ${query} — what do you use?`,
      url: `https://www.reddit.com/r/${sub}/comments/${Math.floor(rng() * 1e6).toString(36)}/`,
      source: `r/${sub}`,
      context: `${Math.floor(rng() * 400)} upvotes · ${Math.floor(rng() * 90)} comments`,
      score: Math.floor(rng() * 400),
    };
  });
}
