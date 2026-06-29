"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, Sparkles, BadgeCheck, ArrowUp } from "lucide-react";
import type { ProjectDashboard, FeatureStatus } from "@/lib/types";

type Msg = ProjectDashboard["messages"][number];

const SUGGESTIONS = ["What should I do first?", "Draft a launch tweet", "Fix my SEO", "Plan my content"];

export default function CmoChat({
  dash,
  status,
  onChange,
}: {
  dash: ProjectDashboard;
  status: FeatureStatus;
  onChange: () => void;
}) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [optimistic, setOptimistic] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = [...dash.messages, ...optimistic.filter((o) => !dash.messages.some((m) => m.id === o.id))];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    setInput("");
    setSending(true);
    const tempUser: Msg = { id: `tmp-${Date.now()}`, role: "user", content: message, createdAt: new Date() as any };
    setOptimistic((o) => [...o, tempUser]);
    try {
      await fetch(`/api/projects/${dash.project.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      onChange();
    } finally {
      setSending(false);
      setOptimistic([]);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 h-11 border-b border-border-subtle shrink-0">
        <h2 className="text-[13px] font-semibold text-ink-muted flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-brand-fg" /> Talk to AI CMO
        </h2>
        <span className="text-[10px] text-ink-faint">{status.ai ? "online" : "local mode"}</span>
      </div>

      {/* Hire banner */}
      <div className="m-3 mb-2 rounded-xl bg-gradient-to-br from-brand/20 to-brand/5 border border-brand/20 p-3 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <BadgeCheck className="w-4 h-4 text-brand-fg" /> Hire your full-time CMO
            </div>
            <div className="text-[11px] text-ink-muted">AI-powered marketing on autopilot</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold leading-none">$99<span className="text-[10px] font-normal text-ink-faint">/mo</span></div>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-ink-faint text-xs py-8">
            <Sparkles className="w-5 h-5 mx-auto mb-2 text-brand-fg" />
            Your CMO is getting up to speed. Run a scan and ask anything.
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} content={m.content} />
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-ink-faint text-xs pl-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> CMO is thinking…
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border-subtle shrink-0">
        {messages.length <= 2 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="px-2 py-1 rounded-full bg-bg-elevated border border-border text-[10px] text-ink-muted hover:bg-bg-hover">
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Ask me anything…"
            className="w-full rounded-xl bg-bg-card border border-border pl-3 pr-10 py-2.5 text-sm outline-none focus:border-brand resize-none scrollbar-thin"
          />
          <button
            onClick={() => send()}
            disabled={sending || !input.trim()}
            className="absolute right-2 bottom-2 h-7 w-7 rounded-lg bg-brand hover:bg-brand/90 text-white flex items-center justify-center disabled:opacity-40"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}

function Bubble({ role, content }: { role: string; content: string }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand text-white px-3 py-2 text-sm whitespace-pre-wrap">{content}</div>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <div className="w-6 h-6 rounded-full bg-brand/20 flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="w-3 h-3 text-brand-fg" />
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-bg-card border border-border-subtle px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed">
        {content}
      </div>
    </div>
  );
}
