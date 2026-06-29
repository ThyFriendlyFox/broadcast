import { parse } from "node-html-parser";
import { env, features } from "../env";
import { domainFromUrl } from "../utils";

export interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
}

// A realistic browser UA — public SERPs serve bot UAs an anti-automation page.
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Web search with graceful degradation:
 *   - Uses a SerpAPI-compatible provider when SEARCH_API_KEY is set.
 *   - Falls back to scraping Bing's public results (no key required).
 * Returns [] on any failure so callers can degrade.
 */
export async function webSearch(query: string, num = 10): Promise<SearchResult[]> {
  if (features.search) {
    const viaApi = await serpApiSearch(query, num);
    if (viaApi.length) return viaApi;
  }
  return bingSearch(query, num);
}

async function serpApiSearch(query: string, num: number): Promise<SearchResult[]> {
  try {
    const u = new URL("https://serpapi.com/search.json");
    u.searchParams.set("engine", "google");
    u.searchParams.set("q", query);
    u.searchParams.set("num", String(num));
    u.searchParams.set("api_key", env.searchApiKey);
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(u.toString(), { signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`serpapi ${res.status}`);
    const data = await res.json();
    return (data.organic_results ?? [])
      .map((r: any) => ({ title: r.title ?? "", url: r.link ?? "", snippet: r.snippet }))
      .filter((r: SearchResult) => r.url);
  } catch (err) {
    console.warn("[search] serpapi failed:", (err as Error).message);
    return [];
  }
}

async function bingSearch(query: string, num: number): Promise<SearchResult[]> {
  try {
    const u = new URL("https://www.bing.com/search");
    u.searchParams.set("q", query);
    u.searchParams.set("count", String(Math.min(num, 20)));
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(u.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(t);
    if (!res.ok) throw new Error(`bing ${res.status}`);
    const root = parse(await res.text());
    const results: SearchResult[] = [];
    for (const li of root.querySelectorAll("li.b_algo")) {
      const a = li.querySelector("h2 a");
      if (!a) continue;
      const url = decodeBingHref(a.getAttribute("href") ?? "");
      const title = a.text.replace(/\s+/g, " ").trim();
      const snippet = li.querySelector(".b_caption p")?.text?.replace(/\s+/g, " ").trim();
      if (url && /^https?:\/\//.test(url) && title) results.push({ title, url, snippet });
      if (results.length >= num) break;
    }
    return results;
  } catch (err) {
    console.warn("[search] bing failed:", (err as Error).message);
    return [];
  }
}

/** Bing wraps result links as /ck/a?...&u=a1<base64url>. Unwrap to the real URL. */
function decodeBingHref(href: string): string {
  if (!href) return "";
  try {
    const u = new URL(href, "https://www.bing.com");
    if (u.hostname.includes("bing.com") && u.pathname.startsWith("/ck/")) {
      const raw = u.searchParams.get("u") ?? "";
      const b64 = (raw.startsWith("a1") ? raw.slice(2) : raw).replace(/-/g, "+").replace(/_/g, "/");
      if (!b64) return "";
      const decoded = Buffer.from(b64, "base64").toString("utf8");
      return /^https?:\/\//.test(decoded) ? decoded : "";
    }
    return href;
  } catch {
    return "";
  }
}

/** Extract a clean, deduped list of domains from search results. */
export function domainsFromResults(results: SearchResult[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of results) {
    const d = domainFromUrl(r.url);
    if (d && !seen.has(d)) {
      seen.add(d);
      out.push(d);
    }
  }
  return out;
}
