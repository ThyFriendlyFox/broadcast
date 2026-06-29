"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Radio, ArrowRight, Sparkles, Search, AtSign as Twitter, FileText, MessageSquare } from "lucide-react";
import type { FeatureStatus } from "@/lib/types";

const STEPS = [
  "Crawling your site",
  "Reading your brand & product",
  "Auditing SEO & performance",
  "Briefing your AI CMO",
];

export default function ConnectLanding({ status }: { status: FeatureStatus }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setStep(0);
    const ticker = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1400);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to connect");
      // Kick off the first scan, then enter the dashboard.
      fetch(`/api/projects/${data.project.id}/scan`, { method: "POST" }).catch(() => {});
      fetch(`/api/projects/${data.project.id}/analytics`, { method: "POST" }).catch(() => {});
      router.push(`/?project=${data.project.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    } finally {
      clearInterval(ticker);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand/20 flex items-center justify-center">
            <Radio className="w-4 h-4 text-brand-fg" />
          </div>
          <span className="font-semibold tracking-tight">Broadcast</span>
        </div>
        <div className="text-xs text-ink-faint">
          AI mode: <span className={status.ai ? "text-good" : "text-ink-muted"}>{status.ai ? status.aiProvider : "local fallback"}</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand/10 text-brand-fg text-xs font-medium mb-5">
              <Sparkles className="w-3.5 h-3.5" /> Your full-time AI CMO
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-balance">
              Connect a project. Watch your CMO go to work.
            </h1>
            <p className="mt-3 text-ink-muted text-balance">
              Broadcast crawls your site, audits SEO, and runs autonomous agents that
              draft and post content across X, Reddit, Hacker News, and LinkedIn.
            </p>
          </div>

          <form onSubmit={connect} className="relative">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              placeholder="yourcompany.com"
              className="w-full h-14 rounded-xl bg-bg-card border border-border px-5 pr-36 text-base outline-none focus:border-brand transition-colors disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="absolute right-2 top-2 h-10 px-4 rounded-lg bg-brand hover:bg-brand/90 text-white text-sm font-medium flex items-center gap-1.5 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Connect <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          {error && <p className="mt-3 text-sm text-bad">{error}</p>}

          {loading ? (
            <div className="mt-8 space-y-2.5">
              {STEPS.map((label, i) => (
                <div key={label} className={`flex items-center gap-3 text-sm transition-opacity ${i <= step ? "opacity-100" : "opacity-40"}`}>
                  {i < step ? (
                    <div className="w-5 h-5 rounded-full bg-good/20 flex items-center justify-center text-good text-xs">✓</div>
                  ) : i === step ? (
                    <Loader2 className="w-5 h-5 text-brand-fg animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-border" />
                  )}
                  <span className={i <= step ? "text-ink" : "text-ink-faint"}>{label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: Search, label: "SEO + Web Vitals" },
                { icon: FileText, label: "Article engine" },
                { icon: Twitter, label: "X posting" },
                { icon: MessageSquare, label: "Reddit / HN" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="rounded-xl border border-border-subtle bg-bg-panel p-3 text-center">
                  <Icon className="w-4 h-4 mx-auto mb-1.5 text-ink-muted" />
                  <span className="text-xs text-ink-muted">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
