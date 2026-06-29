"use client";

import { useState } from "react";
import {
  ChevronDown,
  Loader2,
  ExternalLink,
  Send,
  Copy,
  Check,
  Sparkles,
  X as XIcon,
  Users,
} from "lucide-react";
import type { ProjectDashboard } from "@/lib/types";
import { AGENTS, AGENT_MAP, type AgentType } from "@/lib/agents/registry";
import { AGENT_ICONS } from "@/lib/icons";
import { PanelHeader, StatusDot, Pill } from "@/components/ui";

type FeedItem = ProjectDashboard["feed"][number];

export default function AgentsFeed({
  dash,
  scanning,
  onChange,
  onScan,
}: {
  dash: ProjectDashboard;
  scanning: boolean;
  onChange: () => void;
  onScan: () => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ x_influencer: true, seo: true });
  const [publishItem, setPublishItem] = useState<FeedItem | null>(null);

  const agentState = (type: AgentType) => dash.agents.find((a) => a.type === type);
  const itemsFor = (type: AgentType) => dash.feed.filter((f) => f.agentType === type && f.status !== "dismissed");
  const totalOpen = dash.feed.filter((f) => f.status === "new").length;

  return (
    <>
      <PanelHeader
        title={
          <span className="flex items-center gap-2">
            Agents Feed
            {totalOpen > 0 && <Pill tone="brand">{totalOpen}</Pill>}
          </span>
        }
        action={
          <button onClick={onScan} disabled={scanning} className="text-[11px] text-brand-fg hover:underline flex items-center gap-1">
            {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Scan
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1.5">
        {AGENTS.map((meta) => {
          const state = agentState(meta.type);
          const items = itemsFor(meta.type);
          const Icon = AGENT_ICONS[meta.icon];
          const isOpen = expanded[meta.type];
          return (
            <div key={meta.type} className="rounded-lg border border-border-subtle bg-bg-card overflow-hidden">
              <button
                onClick={() => setExpanded((e) => ({ ...e, [meta.type]: !e[meta.type] }))}
                className="w-full flex items-center gap-2.5 p-2.5 hover:bg-bg-hover text-left"
              >
                <div className="w-7 h-7 rounded-md bg-bg-elevated flex items-center justify-center shrink-0">
                  {Icon && <Icon className={`w-4 h-4 ${meta.accent}`} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold truncate">{meta.name}</span>
                    <StatusDot status={state?.status ?? "idle"} />
                  </div>
                  <div className="text-[11px] text-ink-faint truncate">
                    {state?.status === "scanning" ? "Working…" : state?.summary || meta.defaultSummary}
                  </div>
                </div>
                {items.length > 0 && <Pill>{items.length}</Pill>}
                <ChevronDown className={`w-3.5 h-3.5 text-ink-faint transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="border-t border-border-subtle p-2 space-y-1.5 bg-bg-panel/50">
                  {items.length === 0 ? (
                    <p className="text-[11px] text-ink-faint px-1 py-1">
                      {state?.status === "scanning" ? "Scanning for opportunities…" : "Nothing yet — run a scan."}
                    </p>
                  ) : (
                    items.map((item) => <FeedRow key={item.id} item={item} onPublish={() => setPublishItem(item)} onChange={onChange} />)
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {publishItem && (
        <PublishModal item={publishItem} projectId={dash.project.id} onClose={() => setPublishItem(null)} onDone={onChange} />
      )}
    </>
  );
}

function FeedRow({
  item,
  onPublish,
  onChange,
}: {
  item: FeedItem;
  onPublish: () => void;
  onChange: () => void;
}) {
  const payload = item.payload as any;
  const publishable = item.kind === "post" || item.kind === "campaign";
  const hasBody = Boolean(payload?.body || payload?.tweet || payload?.suggestedReply);

  async function dismiss() {
    await fetch(`/api/feed/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "dismissed" }),
    });
    onChange();
  }

  return (
    <div className="rounded-md bg-bg-card border border-border-subtle p-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium leading-snug">{item.title}</div>
          {item.description && <div className="text-[10px] text-ink-faint mt-0.5 line-clamp-2">{item.description}</div>}
        </div>
        {item.priority === 1 && <Pill tone="bad">high</Pill>}
      </div>

      {payload?.influencers && (
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-ink-faint">
          <Users className="w-3 h-3" /> {payload.influencers.length} matched creators
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-2">
        {publishable && hasBody && (
          <button onClick={onPublish} className="h-6 px-2 rounded-md bg-brand hover:bg-brand/90 text-white text-[10px] font-medium flex items-center gap-1">
            <Send className="w-3 h-3" /> {payload?.platform === "x" || payload?.tweet ? "Publish" : "Review & post"}
          </button>
        )}
        {item.url && (
          <a href={item.url} target="_blank" rel="noreferrer" className="h-6 px-2 rounded-md bg-bg-elevated border border-border text-[10px] flex items-center gap-1 hover:bg-bg-hover">
            <ExternalLink className="w-3 h-3" /> Open
          </a>
        )}
        {payload?.suggestedReply && <CopyButton text={payload.suggestedReply} label="Copy reply" />}
        {payload?.draft && <CopyButton text={payload.draft} label="Copy draft" />}
        <button onClick={dismiss} className="ml-auto h-6 w-6 rounded-md hover:bg-bg-hover flex items-center justify-center text-ink-faint">
          <XIcon className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="h-6 px-2 rounded-md bg-bg-elevated border border-border text-[10px] flex items-center gap-1 hover:bg-bg-hover"
    >
      {copied ? <Check className="w-3 h-3 text-good" /> : <Copy className="w-3 h-3" />} {copied ? "Copied" : label}
    </button>
  );
}

function PublishModal({
  item,
  projectId,
  onClose,
  onDone,
}: {
  item: FeedItem;
  projectId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const payload = item.payload as any;
  const platform: string = payload?.platform || (payload?.tweet ? "x" : "x");
  const initialBody: string = payload?.body || payload?.tweet || "";
  const [body, setBody] = useState(initialBody);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; url?: string; simulated?: boolean; error?: string } | null>(null);

  const meta = AGENT_MAP[item.agentType as AgentType];
  const Icon = AGENT_ICONS[meta?.icon ?? "Send"];
  const isX = platform === "x";

  async function publish() {
    setPublishing(true);
    const res = await fetch(`/api/projects/${projectId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, body, feedItemId: item.id, title: item.title }),
    });
    const data = await res.json();
    setResult({ ok: data.ok, url: data.externalUrl, simulated: data.simulated, error: data.error });
    setPublishing(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-md rounded-xl bg-bg-panel border border-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 h-12 border-b border-border-subtle">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            {Icon && <Icon className={`w-4 h-4 ${meta?.accent}`} />} Publish to {platformLabel(platform)}
          </h3>
          <button onClick={onClose} className="text-ink-faint hover:text-ink"><XIcon className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3">
          {payload?.influencers && (
            <div className="rounded-lg border border-border bg-bg-card p-2.5">
              <div className="text-[10px] uppercase tracking-wide text-ink-faint mb-1.5">Matched influencers</div>
              <div className="space-y-1">
                {payload.influencers.slice(0, 4).map((inf: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="font-medium">{inf.handle}</span>
                    <span className="text-ink-faint">{inf.niche} · {inf.followers?.toLocaleString()} · {inf.fit}% fit</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className="w-full rounded-lg bg-bg-card border border-border p-3 text-sm outline-none focus:border-brand resize-none scrollbar-thin"
          />
          {isX && <div className="text-[10px] text-ink-faint text-right">{body.length}/280</div>}

          {result ? (
            result.ok ? (
              <div className="rounded-lg border border-good/20 bg-good/10 p-3 text-xs text-good">
                {result.simulated ? "Published (simulated — connect X to post live)." : "Published live!"}{" "}
                {result.url && <a href={result.url} target="_blank" rel="noreferrer" className="underline">View</a>}
              </div>
            ) : (
              <div className="rounded-lg border border-bad/20 bg-bad/10 p-3 text-xs text-bad">Failed: {result.error}</div>
            )
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 h-14 border-t border-border-subtle">
          <button onClick={onClose} className="h-8 px-3 rounded-md text-xs text-ink-muted hover:bg-bg-hover">Close</button>
          <button
            onClick={publish}
            disabled={publishing || !body.trim() || (isX && body.length > 280)}
            className="h-8 px-3 rounded-md bg-brand hover:bg-brand/90 text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
          >
            {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Publish
          </button>
        </div>
      </div>
    </div>
  );
}

function platformLabel(p: string): string {
  return { x: "X", linkedin: "LinkedIn", reddit: "Reddit", hackernews: "Hacker News", article: "Blog", ugc_video: "Video" }[p] ?? p;
}
