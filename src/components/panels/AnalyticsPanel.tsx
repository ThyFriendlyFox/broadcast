"use client";

import { useState } from "react";
import { RefreshCw, Loader2, BarChart3, Search, Link2, Wrench, Bot, CheckCircle2, AlertTriangle, Plug } from "lucide-react";
import type { ProjectDashboard } from "@/lib/types";
import type { CrawlResult } from "@/lib/integrations/crawl";
import type { PageSpeedResult } from "@/lib/integrations/pagespeed";
import { ScoreRing, Pill } from "@/components/ui";

type Tab = "seo" | "links" | "technical" | "geo";
const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "seo", label: "SEO", icon: Search },
  { id: "links", label: "Links", icon: Link2 },
  { id: "technical", label: "Technical", icon: Wrench },
  { id: "geo", label: "GEO", icon: Bot },
];

export default function AnalyticsPanel({
  dash,
  analyzing,
  onRefresh,
  onConnect,
}: {
  dash: ProjectDashboard;
  analyzing: boolean;
  onRefresh: () => void;
  onConnect: () => void;
}) {
  const [tab, setTab] = useState<Tab>("seo");
  const { mobile, desktop, crawl } = dash.analytics;

  return (
    <>
      <div className="flex items-center justify-between px-3 h-11 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-colors ${
                tab === t.id ? "bg-bg-elevated text-ink" : "text-ink-faint hover:text-ink-muted"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>
        <button onClick={onRefresh} disabled={analyzing} className="h-7 w-7 rounded-md hover:bg-bg-hover flex items-center justify-center text-ink-faint">
          {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-5">
        <GoogleConnect dash={dash} onConnect={onConnect} />

        {analyzing && !mobile ? (
          <LoadingScores />
        ) : (
          <>
            <PageSpeedScores mobile={mobile} desktop={desktop} />
            <WebVitals mobile={mobile} desktop={desktop} />
          </>
        )}

        {crawl && <TabContent tab={tab} crawl={crawl} />}
      </div>
    </>
  );
}

function GoogleConnect({ dash, onConnect }: { dash: ProjectDashboard; onConnect: () => void }) {
  const ga = dash.integrations.find((i) => i.provider === "google_analytics");
  const sc = dash.integrations.find((i) => i.provider === "search_console");

  async function connect(provider: string) {
    await fetch(`/api/projects/${dash.project.id}/integrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, action: "connect" }),
    });
    onConnect();
  }

  const Card = ({ provider, label, sub, status }: { provider: string; label: string; sub: string; status?: string }) => {
    const connected = status === "connected" || status === "simulated";
    return (
      <button
        onClick={() => connect(provider)}
        className="flex-1 rounded-lg border border-border bg-bg-card p-3 text-left hover:border-brand/40 transition-colors"
      >
        <div className="flex items-center justify-between mb-1">
          <BarChart3 className="w-4 h-4 text-ink-muted" />
          {connected ? <Pill tone={status === "connected" ? "good" : "warn"}>{status === "connected" ? "Connected" : "Demo"}</Pill> : <Plug className="w-3.5 h-3.5 text-ink-faint" />}
        </div>
        <div className="text-xs font-medium">{label}</div>
        <div className="text-[10px] text-ink-faint">{connected ? "Live data flowing" : sub}</div>
      </button>
    );
  };

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-ink-faint mb-2">Connect Google Services</div>
      <div className="flex gap-2">
        <Card provider="google_analytics" label="Google Analytics" sub="Traffic & behavior" status={ga?.status} />
        <Card provider="search_console" label="Search Console" sub="Search rankings" status={sc?.status} />
      </div>
    </div>
  );
}

function LoadingScores() {
  return (
    <div className="flex items-center justify-center py-10 text-ink-faint text-xs gap-2">
      <Loader2 className="w-4 h-4 animate-spin" /> Transferring data from googleapis.com…
    </div>
  );
}

function PageSpeedScores({ mobile, desktop }: { mobile: PageSpeedResult | null; desktop: PageSpeedResult | null }) {
  if (!mobile && !desktop) {
    return <p className="text-xs text-ink-faint">Run a scan to load Lighthouse scores.</p>;
  }
  const Row = ({ label, r }: { label: string; r: PageSpeedResult | null }) =>
    r ? (
      <div>
        <div className="text-[11px] text-ink-muted mb-2 font-medium">{label}</div>
        <div className="grid grid-cols-4 gap-2">
          <ScoreRing score={r.scores.performance} label="Performance" />
          <ScoreRing score={r.scores.accessibility} label="Accessibility" />
          <ScoreRing score={r.scores.bestPractices} label="Best Practices" />
          <ScoreRing score={r.scores.seo} label="SEO" />
        </div>
      </div>
    ) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[10px] uppercase tracking-wide text-ink-faint">PageSpeed Scores</div>
        <span className="text-[10px] text-ink-faint">{mobile?.source === "lighthouse" ? "Lighthouse (live)" : "Estimated"}</span>
      </div>
      <div className="space-y-4">
        <Row label="Mobile" r={mobile} />
        <Row label="Desktop" r={desktop} />
      </div>
    </div>
  );
}

function WebVitals({ mobile, desktop }: { mobile: PageSpeedResult | null; desktop: PageSpeedResult | null }) {
  if (!mobile && !desktop) return null;
  const Col = ({ label, r }: { label: string; r: PageSpeedResult | null }) =>
    r ? (
      <div className="flex-1 rounded-lg border border-border bg-bg-card p-3">
        <div className="text-[11px] text-ink-muted mb-2 font-medium">{label}</div>
        <div className="grid grid-cols-2 gap-2.5">
          {r.vitals.map((v) => (
            <div key={v.id}>
              <div className="flex items-center gap-1 text-[10px] text-ink-faint mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: v.pass ? "#22c55e" : "#ef4444" }} />
                {v.label}
              </div>
              <div className="text-sm font-semibold" style={{ color: v.pass ? "#ededef" : "#f59e0b" }}>{v.value}</div>
              <div className="text-[9px] text-ink-faint">{v.pass ? "Pass" : "Needs work"}</div>
            </div>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-ink-faint mb-2.5">Core Web Vitals</div>
      <div className="flex gap-2">
        <Col label="Desktop" r={desktop} />
        <Col label="Mobile" r={mobile} />
      </div>
    </div>
  );
}

function TabContent({ tab, crawl }: { tab: Tab; crawl: CrawlResult }) {
  const issues = crawl.issues.filter((i) => i.area === tab);

  return (
    <div className="pt-1">
      <div className="text-[10px] uppercase tracking-wide text-ink-faint mb-2">
        {tab === "seo" && "On-page SEO"}
        {tab === "links" && "Link profile"}
        {tab === "technical" && "Technical health"}
        {tab === "geo" && "Generative Engine Optimization"}
      </div>

      {tab === "links" && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Stat label="Internal links" value={crawl.internalLinks} />
          <Stat label="External links" value={crawl.externalLinks} />
        </div>
      )}
      {tab === "seo" && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Stat label="Title length" value={crawl.titleLength} />
          <Stat label="Words" value={crawl.wordCount} />
          <Stat label="Images" value={crawl.imagesTotal} />
        </div>
      )}
      {tab === "geo" && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <BoolStat label="Structured data" ok={crawl.hasStructuredData} />
          <BoolStat label="Open Graph" ok={crawl.hasOpenGraph} />
        </div>
      )}
      {tab === "technical" && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <BoolStat label="HTTPS" ok={crawl.isHttps} />
          <BoolStat label="Canonical" ok={crawl.hasCanonical} />
          <BoolStat label="Viewport" ok={crawl.hasViewport} />
        </div>
      )}

      <div className="space-y-1.5">
        {issues.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-good py-2">
            <CheckCircle2 className="w-4 h-4" /> No {tab} issues detected.
          </div>
        ) : (
          issues.map((iss) => (
            <div key={iss.id} className="rounded-lg border border-border bg-bg-card p-2.5">
              <div className="flex items-center gap-2 mb-0.5">
                <AlertTriangle className={`w-3.5 h-3.5 ${iss.severity === "high" ? "text-bad" : iss.severity === "medium" ? "text-warn" : "text-ink-faint"}`} />
                <span className="text-xs font-medium flex-1">{iss.title}</span>
                <Pill tone={iss.severity === "high" ? "bad" : iss.severity === "medium" ? "warn" : "default"}>{iss.severity}</Pill>
              </div>
              <p className="text-[11px] text-ink-muted pl-6 leading-relaxed">{iss.detail}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-bg-card p-2.5">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-[10px] text-ink-faint">{label}</div>
    </div>
  );
}

function BoolStat({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-bg-card p-2.5">
      <div className="flex items-center gap-1.5">
        {ok ? <CheckCircle2 className="w-4 h-4 text-good" /> : <AlertTriangle className="w-4 h-4 text-warn" />}
        <span className="text-xs font-medium">{ok ? "Yes" : "No"}</span>
      </div>
      <div className="text-[10px] text-ink-faint mt-0.5">{label}</div>
    </div>
  );
}
