"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Radio, RefreshCw, Loader2, ChevronDown, Plus } from "lucide-react";
import type { ProjectDashboard, FeatureStatus, ProjectSummary } from "@/lib/types";
import CompanyPanel from "@/components/panels/CompanyPanel";
import AnalyticsPanel from "@/components/panels/AnalyticsPanel";
import AgentsFeed from "@/components/panels/AgentsFeed";
import CmoChat from "@/components/panels/CmoChat";
import { Pill } from "@/components/ui";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function Dashboard({
  initialData,
  projects,
  status,
}: {
  initialData: ProjectDashboard;
  projects: ProjectSummary[];
  status: FeatureStatus;
}) {
  const projectId = initialData.project.id;
  const [scanning, setScanning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const { data, mutate } = useSWR<ProjectDashboard>(`/api/projects/${projectId}`, fetcher, {
    fallbackData: initialData,
    refreshInterval: (latest) => {
      const busy = latest?.agents?.some((a) => a.status === "scanning");
      return busy || scanning || analyzing ? 2500 : 20000;
    },
  });

  const dash = data ?? initialData;

  const runScan = useCallback(async () => {
    setScanning(true);
    setAnalyzing(true);
    try {
      await Promise.all([
        fetch(`/api/projects/${projectId}/scan`, { method: "POST" }).then(() => mutate()),
        fetch(`/api/projects/${projectId}/analytics`, { method: "POST" }).then(() => mutate()),
      ]);
    } finally {
      setScanning(false);
      setAnalyzing(false);
      mutate();
    }
  }, [projectId, mutate]);

  const refresh = useCallback(() => mutate(), [mutate]);

  return (
    <div className="h-screen flex flex-col bg-bg text-ink overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 h-12 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-brand/20 flex items-center justify-center">
              <Radio className="w-3.5 h-3.5 text-brand-fg" />
            </div>
            <span className="font-semibold text-sm tracking-tight">Broadcast</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setSwitcherOpen((o) => !o)}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-bg-card border border-border text-xs hover:bg-bg-hover"
            >
              <span className="font-medium">{dash.project.name}</span>
              <ChevronDown className="w-3 h-3 text-ink-faint" />
            </button>
            {switcherOpen && (
              <div className="absolute z-30 mt-1 w-56 rounded-lg bg-bg-elevated border border-border shadow-xl py-1">
                {projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/?project=${p.id}`}
                    className={`block px-3 py-2 text-xs hover:bg-bg-hover ${p.id === projectId ? "text-brand-fg" : "text-ink-muted"}`}
                  >
                    <div className="font-medium">{p.name}</div>
                    <div className="text-[10px] text-ink-faint">{p.domain}</div>
                  </Link>
                ))}
                <Link href="/?new=1" className="flex items-center gap-1.5 px-3 py-2 text-xs text-ink-muted hover:bg-bg-hover border-t border-border-subtle mt-1">
                  <Plus className="w-3 h-3" /> Connect new project
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Pill tone={status.ai ? "good" : "default"}>AI: {status.ai ? status.aiProvider : "local"}</Pill>
          <Pill tone={status.xPosting ? "good" : "warn"}>X: {status.xPosting ? "live" : "simulated"}</Pill>
          <button
            onClick={runScan}
            disabled={scanning}
            className="flex items-center gap-1.5 h-7 px-3 rounded-md bg-brand hover:bg-brand/90 text-white text-xs font-medium disabled:opacity-60"
          >
            {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {scanning ? "Scanning…" : "Scan now"}
          </button>
        </div>
      </header>

      {/* Four-panel workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_minmax(0,380px)_minmax(0,360px)] overflow-hidden">
        <div className="hidden lg:flex flex-col border-r border-border-subtle bg-bg-panel overflow-hidden">
          <CompanyPanel dash={dash} onChange={refresh} />
        </div>
        <div className="flex flex-col border-r border-border-subtle bg-bg overflow-hidden">
          <AnalyticsPanel dash={dash} analyzing={analyzing} onRefresh={async () => {
            setAnalyzing(true);
            await fetch(`/api/projects/${projectId}/analytics`, { method: "POST" }).catch(() => {});
            setAnalyzing(false);
            mutate();
          }} onConnect={refresh} />
        </div>
        <div className="hidden lg:flex flex-col border-r border-border-subtle bg-bg-panel overflow-hidden">
          <AgentsFeed dash={dash} scanning={scanning} onChange={refresh} onScan={runScan} />
        </div>
        <div className="hidden lg:flex flex-col bg-bg-panel overflow-hidden">
          <CmoChat dash={dash} status={status} onChange={refresh} />
        </div>
      </div>
    </div>
  );
}
