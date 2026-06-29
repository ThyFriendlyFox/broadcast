# Broadcast — your full-time AI CMO

Broadcast is a working clone (and superset) of an "AI CMO" marketing platform.
You connect a project (a website), and Broadcast instantly:

- crawls and **audits** your site (SEO, performance, technical, GEO),
- builds your **company knowledge base** (product, brand voice, strategy, `llms.txt`, competitors),
- runs a fleet of **autonomous marketing agents** that surface live opportunities and draft content, and
- gives you an **AI CMO chat** that prioritizes the work and can **publish** — including real posting to **X (Twitter)**.

It is built to run with **zero external credentials** (everything degrades to a
deterministic local mode) and to light up **live** capabilities automatically as
you add API keys.

---

## Quick start

```bash
pnpm install           # installs deps + generates Prisma client
cp .env.example .env   # optional: add API keys to go "live"
pnpm db:push           # create the SQLite database (first run only)
pnpm dev               # http://localhost:3000
```

Open the app, type a domain (e.g. `yourcompany.com`), and click **Connect**.
Broadcast crawls the site, generates your profile, runs the first scan, and drops
you into the dashboard.

> No keys? You still get a fully working product: real site crawling, real
> Lighthouse scores (public PageSpeed endpoint), real Reddit/Hacker News
> discovery, deterministic AI‑style content, and a **simulated** publishing outbox.

---

## The dashboard (matches the reference, panel for panel)

A four‑panel cockpit:

| Panel | What it does |
|---|---|
| **Company** (left) | Profile + editable knowledge docs (Product Information, Brand Voice, Competitor Analysis, Marketing Strategy, `llms.txt`, Articles) and a managed competitor list. |
| **Analytics** (center) | `SEO / Links / Technical / GEO` tabs, **Connect Google Services** (Analytics + Search Console), **PageSpeed Scores** (mobile + desktop Lighthouse rings), and **Core Web Vitals** (LCP, FCP, TBT, CLS with pass/fail). |
| **Agents Feed** (center‑right) | Every agent with a live status dot and an expandable feed of opportunities, drafts, fixes, and campaigns — each with one‑click actions. |
| **Talk to AI CMO** (right) | The "Hire your full‑time CMO" banner + a chat that knows your project, reads the live feed, and can ship work. |

---

## Feature plan — everything in the screenshot, and more

### 1. Connect a project (onboarding)
- Enter a URL → site is crawled, a company profile is **inferred** (name, category,
  description), and the knowledge base + agent roster + integration slots are seeded.
- An initial audit is stored so the dashboard has data on first paint.
- Connect additional projects and switch between them from the top bar.

### 2. Company knowledge base
- Six document types auto‑generated and **editable** in a side drawer.
- `llms.txt` generated for AI/answer‑engine guidance.
- Competitor list with add/remove; feeds comparison content and positioning.

### 3. Analytics (live audit)
- **PageSpeed / Lighthouse**: Performance, Accessibility, Best Practices, SEO for
  mobile **and** desktop (real Google PageSpeed Insights; falls back to a
  deterministic estimate if the API is unreachable/rate‑limited).
- **Core Web Vitals**: LCP, FCP, TBT, CLS with pass thresholds, per device.
- **On‑page crawl**: title, meta description, headings, word count, internal/external
  links, image alt coverage, canonical/viewport/HTTPS, Open Graph, and JSON‑LD
  structured data.
- Tabs slice findings into **SEO / Links / Technical / GEO** with prioritized issues.
- **Connect Google Services** records connection state (live when OAuth creds exist).

### 4. Marketing agents (the "live checking for content to make")
Each agent runs on a scan (manual **Scan now**, on connect, or via the cron endpoint):

| Agent | Output |
|---|---|
| **X Influencer Agent** | Matched creator shortlist + a branded tweet + outreach DM template; launches campaigns. |
| **Reddit Agent** | Buying‑intent threads (live Reddit search) + drafted, non‑spammy replies. |
| **SEO Agent** | Prioritized technical + on‑page fixes from the crawl, plus strategic recommendations. |
| **Articles Agent** | Keyword‑driven topic ideas + a full, on‑brand first draft. |
| **Hacker News Agent** | A "Show HN" post + relevant HN threads to comment on (live HN search). |
| **LinkedIn Agent** | Founder‑voice LinkedIn post drafts. |
| **UGC Videos Agent** | Short‑form video scripts with a hook → problem → reveal → CTA shot list. |

### 5. Publishing — including real X posting
- One‑click **Publish** on any post/campaign opens a review modal (edit + char count).
- **X (Twitter)**: posts live via the X API v2 when OAuth1.0a user credentials are
  set; otherwise stored in a **simulated outbox** so the workflow is fully usable.
- LinkedIn / Reddit / Hacker News / blog / video are recorded in the outbox
  (native write APIs require per‑user OAuth apps; the content + flow are ready).

### 6. AI CMO chat
- A daily **briefing** is posted after the first scan ("here's what I've got today…").
- Chat replies are project‑aware and reference the **actual** live feed; with an AI
  key it uses OpenAI/Anthropic, otherwise a capable local strategist responds.
- Quick‑prompt chips: *What should I do first? / Draft a launch tweet / Fix my SEO / Plan my content*.

### 7. Live + scheduled scanning
- The dashboard **polls** while agents work, so statuses animate idle → scanning → ready.
- `GET /api/cron/scan?secret=...` re‑scans every project — wire it to any cron
  (Vercel Cron, GitHub Actions, system cron) for always‑fresh opportunities.

---

## Going live (optional keys)

Add to `.env` to upgrade simulated features to live ones (see `.env.example`):

| Capability | Variables |
|---|---|
| AI generation + smarter CMO | `OPENAI_API_KEY` *(or)* `ANTHROPIC_API_KEY` |
| Real X posting | `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` |
| Higher PageSpeed limits | `PAGESPEED_API_KEY` |
| Google Analytics / Search Console | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Authenticated Reddit | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` |
| Cron auth | `CRON_SECRET` |

The header pills show current mode at a glance (e.g. `AI: local`, `X: simulated`).

---

## Architecture

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS** — one full‑stack app.
- **Prisma + SQLite** — zero‑config local database (`prisma/dev.db`).
- **Agent engine** (`src/lib/agents`) — a registry + per‑agent runners + an orchestrator.
- **Integrations** (`src/lib/integrations`) — PageSpeed, on‑page crawler, X posting, Reddit/HN discovery.
- **AI layer** (`src/lib/ai.ts`) — OpenAI/Anthropic with a guaranteed local fallback.

```
src/
  app/                     # pages + API routes
    api/                   # projects, scan, analytics, chat, publish, feed, integrations, cron
  components/
    panels/                # CompanyPanel, AnalyticsPanel, AgentsFeed, CmoChat
    ConnectLanding.tsx     # onboarding
    Dashboard.tsx          # 4-panel shell + live polling
  lib/
    agents/                # registry, context, per-agent runners, engine
    integrations/          # pagespeed, crawl, x, discovery
    ai.ts  cmo.ts  onboard.ts  queries.ts  env.ts  prisma.ts  utils.ts
prisma/schema.prisma       # data model
```

### Key API routes
- `POST /api/projects` — connect a project · `GET` — list
- `GET/DELETE /api/projects/:id` — full dashboard payload / remove
- `POST /api/projects/:id/scan[?agent=type]` — run all agents (or one)
- `POST /api/projects/:id/analytics` — re‑run Lighthouse + crawl
- `POST /api/projects/:id/chat` — talk to the CMO · `GET` — history
- `POST /api/projects/:id/publish` — publish content (live X when configured)
- `POST /api/projects/:id/integrations` — connect/disconnect a provider
- `POST/DELETE /api/projects/:id/competitors` · `PATCH /api/documents/:id` · `PATCH /api/feed/:id`
- `GET /api/cron/scan?secret=...` — scheduled scan of all projects
- `GET /api/status` — current feature/live‑mode flags

## Scripts
- `pnpm dev` — dev server
- `pnpm build` — generate client, apply migrations, build
- `pnpm start` — production server
- `pnpm lint` — ESLint
- `pnpm db:push` — sync schema to SQLite

## Notes
- This is a starting platform, not a hosted service. "Simulated" actions are clearly
  labeled in the UI and exist so the entire workflow is demonstrable without secrets.
- Respect each platform's automation/ToS before enabling live posting at scale.
