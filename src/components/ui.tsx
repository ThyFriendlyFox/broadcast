"use client";

import { cn } from "@/lib/utils";

export function scoreColor(score: number): string {
  if (score >= 90) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

export function ScoreRing({ score, label, size = 56 }: { score: number; label: string; size?: number }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color = scoreColor(score);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="#26262b" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold" style={{ color }}>
          {score}
        </span>
      </div>
      <span className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</span>
    </div>
  );
}

export function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    ready: "bg-good",
    connected: "bg-good",
    scanning: "bg-brand-fg animate-pulse-dot",
    idle: "bg-ink-faint",
    simulated: "bg-warn",
    disconnected: "bg-ink-faint",
    error: "bg-bad",
  };
  return <span className={cn("inline-block w-1.5 h-1.5 rounded-full", map[status] ?? "bg-ink-faint")} />;
}

export function Pill({ children, tone = "default", className }: { children: React.ReactNode; tone?: "default" | "good" | "warn" | "bad" | "brand"; className?: string }) {
  const tones: Record<string, string> = {
    default: "bg-bg-elevated text-ink-muted border-border",
    good: "bg-good/10 text-good border-good/20",
    warn: "bg-warn/10 text-warn border-warn/20",
    bad: "bg-bad/10 text-bad border-bad/20",
    brand: "bg-brand/10 text-brand-fg border-brand/20",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border", tones[tone], className)}>
      {children}
    </span>
  );
}

export function PanelHeader({ title, action }: { title: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 h-11 border-b border-border-subtle shrink-0">
      <h2 className="text-[13px] font-semibold text-ink-muted">{title}</h2>
      {action}
    </div>
  );
}
