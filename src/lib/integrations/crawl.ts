import { parse } from "node-html-parser";
import { normalizeUrl, domainFromUrl } from "../utils";

export interface CrawlIssue {
  id: string;
  severity: "high" | "medium" | "low";
  area: "seo" | "technical" | "links" | "geo";
  title: string;
  detail: string;
}

export interface CrawlResult {
  url: string;
  ok: boolean;
  statusCode?: number;
  title?: string;
  titleLength: number;
  metaDescription?: string;
  metaDescriptionLength: number;
  h1Count: number;
  h1s: string[];
  wordCount: number;
  internalLinks: number;
  externalLinks: number;
  imagesTotal: number;
  imagesMissingAlt: number;
  hasCanonical: boolean;
  hasViewport: boolean;
  hasOpenGraph: boolean;
  hasStructuredData: boolean;
  structuredDataTypes: string[];
  hasFavicon: boolean;
  isHttps: boolean;
  hasRobotsMeta: boolean;
  issues: CrawlIssue[];
  fetchedAt: string;
  error?: string;
}

export async function crawlSite(rawUrl: string): Promise<CrawlResult> {
  const url = normalizeUrl(rawUrl);
  const base: CrawlResult = {
    url,
    ok: false,
    titleLength: 0,
    metaDescriptionLength: 0,
    h1Count: 0,
    h1s: [],
    wordCount: 0,
    internalLinks: 0,
    externalLinks: 0,
    imagesTotal: 0,
    imagesMissingAlt: 0,
    hasCanonical: false,
    hasViewport: false,
    hasOpenGraph: false,
    hasStructuredData: false,
    structuredDataTypes: [],
    hasFavicon: false,
    isHttps: url.startsWith("https://"),
    hasRobotsMeta: false,
    issues: [],
    fetchedAt: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "BroadcastBot/1.0 (+SEO audit)" },
      redirect: "follow",
    });
    clearTimeout(t);
    base.statusCode = res.status;
    if (!res.ok) {
      base.error = `Upstream returned ${res.status}`;
      base.issues.push({
        id: "http-error",
        severity: "high",
        area: "technical",
        title: `Homepage returned HTTP ${res.status}`,
        detail: "Search engines may struggle to index a page that does not return 200.",
      });
      return base;
    }
    const html = await res.text();
    const root = parse(html);
    const domain = domainFromUrl(url);

    const title = root.querySelector("title")?.text?.trim();
    base.title = title;
    base.titleLength = title?.length ?? 0;

    const desc = root.querySelector('meta[name="description"]')?.getAttribute("content")?.trim();
    base.metaDescription = desc;
    base.metaDescriptionLength = desc?.length ?? 0;

    const h1s = root.querySelectorAll("h1").map((h) => h.text.trim()).filter(Boolean);
    base.h1s = h1s.slice(0, 5);
    base.h1Count = h1s.length;

    const text = root.querySelector("body")?.text?.replace(/\s+/g, " ").trim() ?? "";
    base.wordCount = text ? text.split(" ").length : 0;

    const links = root.querySelectorAll("a[href]");
    for (const a of links) {
      const href = a.getAttribute("href") ?? "";
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
      if (href.startsWith("/") || href.includes(domain)) base.internalLinks++;
      else if (/^https?:\/\//.test(href)) base.externalLinks++;
    }

    const imgs = root.querySelectorAll("img");
    base.imagesTotal = imgs.length;
    base.imagesMissingAlt = imgs.filter((i) => !i.getAttribute("alt")?.trim()).length;

    base.hasCanonical = Boolean(root.querySelector('link[rel="canonical"]'));
    base.hasViewport = Boolean(root.querySelector('meta[name="viewport"]'));
    base.hasOpenGraph = Boolean(root.querySelector('meta[property^="og:"]'));
    base.hasFavicon = Boolean(root.querySelector('link[rel*="icon"]'));
    base.hasRobotsMeta = Boolean(root.querySelector('meta[name="robots"]'));

    const ldScripts = root.querySelectorAll('script[type="application/ld+json"]');
    const types = new Set<string>();
    for (const s of ldScripts) {
      try {
        const parsed = JSON.parse(s.text);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of arr) {
          if (item?.["@type"]) types.add(String(item["@type"]));
        }
      } catch {
        /* ignore malformed */
      }
    }
    base.hasStructuredData = types.size > 0;
    base.structuredDataTypes = [...types];

    base.ok = true;
    base.issues = deriveIssues(base);
    return base;
  } catch (err) {
    base.error = (err as Error).message;
    base.issues.push({
      id: "fetch-failed",
      severity: "high",
      area: "technical",
      title: "Could not fetch the site",
      detail: `Crawler error: ${(err as Error).message}. The site may block bots or be unreachable.`,
    });
    return base;
  }
}

function deriveIssues(c: CrawlResult): CrawlIssue[] {
  const issues: CrawlIssue[] = [];
  if (!c.title) {
    issues.push({ id: "missing-title", severity: "high", area: "seo", title: "Missing <title> tag", detail: "Every page needs a unique, descriptive title (50–60 chars)." });
  } else if (c.titleLength > 60) {
    issues.push({ id: "long-title", severity: "low", area: "seo", title: "Title tag is too long", detail: `Title is ${c.titleLength} chars; aim for 50–60 to avoid truncation in SERPs.` });
  } else if (c.titleLength < 20) {
    issues.push({ id: "short-title", severity: "medium", area: "seo", title: "Title tag is short", detail: `Title is only ${c.titleLength} chars; add primary keywords and value prop.` });
  }
  if (!c.metaDescription) {
    issues.push({ id: "missing-desc", severity: "medium", area: "seo", title: "Missing meta description", detail: "Add a 140–160 char description to improve click-through from search." });
  } else if (c.metaDescriptionLength > 165) {
    issues.push({ id: "long-desc", severity: "low", area: "seo", title: "Meta description too long", detail: `Description is ${c.metaDescriptionLength} chars; it will be truncated.` });
  }
  if (c.h1Count === 0) {
    issues.push({ id: "missing-h1", severity: "medium", area: "seo", title: "No H1 heading found", detail: "Add a single, keyword-rich H1 that states the page's purpose." });
  } else if (c.h1Count > 1) {
    issues.push({ id: "multiple-h1", severity: "low", area: "seo", title: `Multiple H1 tags (${c.h1Count})`, detail: "Use one H1 per page for a clear content hierarchy." });
  }
  if (c.imagesMissingAlt > 0) {
    issues.push({ id: "missing-alt", severity: "medium", area: "seo", title: `${c.imagesMissingAlt} image(s) missing alt text`, detail: "Descriptive alt text improves accessibility and image SEO." });
  }
  if (!c.hasCanonical) {
    issues.push({ id: "no-canonical", severity: "low", area: "technical", title: "No canonical tag", detail: "Add a canonical link to avoid duplicate-content dilution." });
  }
  if (!c.hasViewport) {
    issues.push({ id: "no-viewport", severity: "high", area: "technical", title: "Missing viewport meta", detail: "Without a viewport tag the site won't be mobile-friendly." });
  }
  if (!c.isHttps) {
    issues.push({ id: "no-https", severity: "high", area: "technical", title: "Not served over HTTPS", detail: "HTTPS is a ranking signal and required for modern browser features." });
  }
  if (!c.hasOpenGraph) {
    issues.push({ id: "no-og", severity: "low", area: "geo", title: "No Open Graph tags", detail: "OG tags control how links render when shared and cited by AI engines." });
  }
  if (!c.hasStructuredData) {
    issues.push({ id: "no-schema", severity: "medium", area: "geo", title: "No structured data (JSON-LD)", detail: "Schema markup helps AI/answer engines understand and cite your content." });
  }
  if (c.wordCount < 300) {
    issues.push({ id: "thin-content", severity: "medium", area: "geo", title: "Thin homepage content", detail: `Only ~${c.wordCount} words found. AI engines favor substantive, structured content.` });
  }
  if (c.externalLinks === 0) {
    issues.push({ id: "no-external", severity: "low", area: "links", title: "No outbound links", detail: "Citing authoritative sources can build topical relevance and trust." });
  }
  return issues;
}
