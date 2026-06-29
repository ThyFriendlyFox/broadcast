// Client-safe metadata describing every marketing agent in the platform.

export type AgentType =
  | "seo"
  | "articles"
  | "reddit"
  | "hackernews"
  | "linkedin"
  | "x_influencer"
  | "ugc_videos";

export interface AgentMeta {
  type: AgentType;
  name: string;
  icon: string; // lucide-react icon name
  accent: string; // tailwind color class
  tagline: string;
  description: string;
  /** Default summary shown before the first scan. */
  defaultSummary: string;
}

export const AGENTS: AgentMeta[] = [
  {
    type: "x_influencer",
    name: "X Influencer Agent",
    icon: "Twitter",
    accent: "text-sky-400",
    tagline: "1000 influencers waiting",
    description:
      "Finds relevant X creators, drafts outreach + branded tweets, and launches influencer campaigns. Can publish to your connected X account.",
    defaultSummary: "Launch your first campaign (1000 influencers waiting)",
  },
  {
    type: "reddit",
    name: "Reddit Agent",
    icon: "MessageSquare",
    accent: "text-orange-400",
    tagline: "Find live threads",
    description:
      "Monitors subreddits for buying-intent threads where your product is a genuine answer, and drafts authentic, non-spammy replies.",
    defaultSummary: "Scanning subreddits for opportunities",
  },
  {
    type: "seo",
    name: "SEO Agent",
    icon: "Search",
    accent: "text-emerald-400",
    tagline: "Technical + on-page fixes",
    description:
      "Audits your site (Lighthouse + on-page crawl), surfaces prioritized fixes, and queues them as actionable recommendations.",
    defaultSummary: "Auditing your site",
  },
  {
    type: "articles",
    name: "Articles Agent",
    icon: "FileText",
    accent: "text-violet-400",
    tagline: "SEO content engine",
    description:
      "Builds a keyword-driven content calendar and writes full, on-brand article drafts ready to publish.",
    defaultSummary: "Researching topics",
  },
  {
    type: "hackernews",
    name: "Hacker News Agent",
    icon: "Newspaper",
    accent: "text-amber-500",
    tagline: "Show HN + comments",
    description:
      "Finds relevant HN discussions and drafts a high-signal Show HN post or thoughtful comment that fits your launch.",
    defaultSummary: "Looking for relevant discussions",
  },
  {
    type: "linkedin",
    name: "LinkedIn Agent",
    icon: "Linkedin",
    accent: "text-blue-400",
    tagline: "Founder-voice posts",
    description:
      "Writes LinkedIn posts in your founder voice — narrative hooks, insights, and CTAs tuned for B2B reach.",
    defaultSummary: "Drafting your next post",
  },
  {
    type: "ugc_videos",
    name: "UGC Videos Agent",
    icon: "Video",
    accent: "text-pink-400",
    tagline: "Short-form scripts",
    description:
      "Generates UGC-style short-form video scripts and shot lists (hook, demo, CTA) for TikTok, Reels, and Shorts.",
    defaultSummary: "Storyboarding your next video",
  },
];

export const AGENT_MAP: Record<AgentType, AgentMeta> = Object.fromEntries(
  AGENTS.map((a) => [a.type, a]),
) as Record<AgentType, AgentMeta>;
