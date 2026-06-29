"use client";

import { useState } from "react";
import {
  FileText,
  Palette,
  Swords,
  Target,
  ScrollText,
  Newspaper,
  Plus,
  X,
  Loader2,
  Save,
  Globe,
  Sparkles,
  Check,
  Minus,
  RefreshCw,
} from "lucide-react";
import type { ProjectDashboard } from "@/lib/types";
import { PanelHeader, Pill } from "@/components/ui";

const DOC_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  product_information: FileText,
  brand_voice: Palette,
  competitor_analysis: Swords,
  marketing_strategy: Target,
  llms_txt: ScrollText,
  articles: Newspaper,
};

export default function CompanyPanel({ dash, onChange }: { dash: ProjectDashboard; onChange: () => void }) {
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  const [newCompetitor, setNewCompetitor] = useState("");
  const [adding, setAdding] = useState(false);
  const [discovering, setDiscovering] = useState(false);

  const doc = dash.documents.find((d) => d.id === openDoc);
  const analyzing = dash.documents.find((d) => d.type === "competitor_analysis")?.status === "generating";

  async function addCompetitor() {
    if (!newCompetitor.trim()) return;
    setAdding(true);
    await fetch(`/api/projects/${dash.project.id}/competitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: newCompetitor }),
    });
    setNewCompetitor("");
    setAdding(false);
    onChange();
  }

  async function removeCompetitor(id: string) {
    await fetch(`/api/projects/${dash.project.id}/competitors?competitorId=${id}`, { method: "DELETE" });
    onChange();
  }

  async function discover() {
    setDiscovering(true);
    try {
      await fetch(`/api/projects/${dash.project.id}/acquire`, { method: "POST" });
    } finally {
      setDiscovering(false);
      onChange();
    }
  }

  return (
    <>
      <PanelHeader title="Company" />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Profile */}
        <div className="p-4 border-b border-border-subtle">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold text-white shrink-0"
              style={{ background: dash.project.brandColor || "#6366f1" }}
            >
              {dash.project.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{dash.project.name}</div>
              <a href={dash.project.url} target="_blank" rel="noreferrer" className="text-[11px] text-ink-faint hover:text-ink-muted flex items-center gap-1 truncate">
                <Globe className="w-3 h-3 shrink-0" /> {dash.project.domain}
              </a>
            </div>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed line-clamp-4">{dash.project.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {dash.project.category && <Pill tone="brand">{dash.project.category}</Pill>}
          </div>
        </div>

        {/* Documents */}
        <div className="p-3 border-b border-border-subtle">
          <div className="text-[10px] uppercase tracking-wide text-ink-faint px-1 mb-1.5">Documents</div>
          <div className="space-y-0.5">
            {dash.documents.map((d) => {
              const Icon = DOC_ICONS[d.type] ?? FileText;
              return (
                <button
                  key={d.id}
                  onClick={() => setOpenDoc(d.id)}
                  className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-bg-hover text-left group"
                >
                  <Icon className="w-3.5 h-3.5 text-ink-faint group-hover:text-ink-muted shrink-0" />
                  <span className="text-xs flex-1 truncate">{d.title}</span>
                  {d.status === "new" && <Pill tone="brand">New</Pill>}
                  {d.status === "generating" && <Loader2 className="w-3 h-3 animate-spin text-brand-fg" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Competitors */}
        <div className="p-3">
          <div className="flex items-center justify-between px-1 mb-1.5">
            <span className="text-[10px] uppercase tracking-wide text-ink-faint">Competitors</span>
            <button
              onClick={discover}
              disabled={discovering || analyzing}
              className="flex items-center gap-1 text-[10px] text-brand-fg hover:text-brand disabled:opacity-50"
              title="Auto-discover and analyze competitors"
            >
              {discovering || analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {discovering || analyzing ? "Analyzing…" : "Discover"}
            </button>
          </div>
          <div className="space-y-0.5">
            {dash.competitors.map((c) => (
              <div key={c.id} className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-bg-hover group">
                <span className="w-1.5 h-1.5 rounded-full bg-ink-faint shrink-0 mt-1.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs truncate">{c.name || c.domain}</div>
                  {c.notes ? (
                    <div className="text-[10px] text-ink-faint line-clamp-1">{c.notes}</div>
                  ) : (
                    <div className="text-[10px] text-ink-faint truncate">{c.domain}</div>
                  )}
                </div>
                <button onClick={() => removeCompetitor(c.id)} className="opacity-0 group-hover:opacity-100 text-ink-faint hover:text-bad mt-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {dash.competitors.length === 0 && (
              <p className="px-2 py-1 text-[11px] text-ink-faint">
                {discovering || analyzing ? "Discovering competitors…" : "No competitors yet. Click Discover or add one."}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <input
              value={newCompetitor}
              onChange={(e) => setNewCompetitor(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCompetitor()}
              placeholder="competitor.com"
              className="flex-1 h-7 rounded-md bg-bg-card border border-border px-2 text-xs outline-none focus:border-brand"
            />
            <button onClick={addCompetitor} disabled={adding} className="h-7 w-7 rounded-md bg-bg-elevated border border-border flex items-center justify-center hover:bg-bg-hover">
              {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {doc && doc.type === "competitor_analysis" ? (
        <CompetitorAnalysisDrawer
          dash={dash}
          doc={doc}
          analyzing={analyzing}
          onClose={() => setOpenDoc(null)}
          onSaved={onChange}
        />
      ) : (
        doc && <DocDrawer doc={doc} onClose={() => setOpenDoc(null)} onSaved={onChange} />
      )}
    </>
  );
}

function DocDrawer({
  doc,
  onClose,
  onSaved,
}: {
  doc: ProjectDashboard["documents"][number];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [content, setContent] = useState(doc.content);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, status: "ready" }),
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <Drawer title={doc.title} onClose={onClose}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 p-4 bg-transparent text-sm leading-relaxed outline-none resize-none scrollbar-thin font-mono"
        placeholder="This document is empty. Add details or run a scan to populate it."
      />
      <DrawerFooter onClose={onClose} onSave={save} saving={saving} />
    </Drawer>
  );
}

function CompetitorAnalysisDrawer({
  dash,
  doc,
  analyzing,
  onClose,
  onSaved,
}: {
  dash: ProjectDashboard;
  doc: ProjectDashboard["documents"][number];
  analyzing?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const analysis = dash.competitorAnalysis;
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(doc.content);
  const [saving, setSaving] = useState(false);
  const [rerunning, setRerunning] = useState(false);

  const nameFor = (domain: string) =>
    dash.competitors.find((c) => c.domain === domain)?.name || domain;

  async function save() {
    setSaving(true);
    await fetch(`/api/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, status: "ready" }),
    });
    setSaving(false);
    onSaved();
    setEditing(false);
  }

  async function rerun() {
    setRerunning(true);
    try {
      await fetch(`/api/projects/${dash.project.id}/acquire?discover=0`, { method: "POST" });
    } finally {
      setRerunning(false);
      onSaved();
    }
  }

  return (
    <Drawer title="Competitor Analysis" onClose={onClose}>
      {editing ? (
        <>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 p-4 bg-transparent text-sm leading-relaxed outline-none resize-none scrollbar-thin font-mono"
          />
          <DrawerFooter onClose={() => setEditing(false)} onSave={save} saving={saving} />
        </>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-5">
            {analyzing && (
              <div className="flex items-center gap-2 text-xs text-brand-fg">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing competitors from live crawl…
              </div>
            )}

            {!analysis && !analyzing && (
              <p className="text-xs text-ink-faint">
                No analysis yet. Add competitors or click Discover to crawl and compare them.
              </p>
            )}

            {analysis && (
              <>
                <p className="text-sm text-ink-muted leading-relaxed">{analysis.summary}</p>

                {/* Positioning */}
                {analysis.positioning.length > 0 && (
                  <Section title="Positioning">
                    <div className="space-y-2">
                      {analysis.positioning.map((p) => (
                        <div key={p.domain} className="rounded-lg border border-border bg-bg-card p-2.5">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-medium truncate">{p.name}</span>
                            {p.isYou && <Pill tone="brand">You</Pill>}
                            {p.pricingFrom && <span className="ml-auto text-[10px] text-ink-faint">from {p.pricingFrom}</span>}
                          </div>
                          <div className="text-[11px] text-ink-muted leading-snug">{p.positioning}</div>
                          {p.audience && <div className="text-[10px] text-ink-faint mt-0.5">Audience: {p.audience}</div>}
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Feature gaps */}
                {analysis.featureComparison.length > 0 && (
                  <Section title="Feature gaps">
                    <div className="space-y-1.5">
                      {analysis.featureComparison.map((r, i) => {
                        const have = Object.entries(r.competitors).filter(([, v]) => v).map(([d]) => d);
                        return (
                          <div key={i} className="text-[11px]">
                            <div className="flex items-center gap-1.5">
                              {r.you ? <Check className="w-3 h-3 text-good shrink-0" /> : <Minus className="w-3 h-3 text-bad shrink-0" />}
                              <span className={r.you ? "text-ink-muted" : "text-ink"}>{r.feature}</span>
                            </div>
                            {!r.you && have.length > 0 && (
                              <div className="pl-4 text-[10px] text-ink-faint">
                                competitors with it: {have.map(nameFor).join(", ")}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Section>
                )}

                {/* Content gaps */}
                {analysis.contentGaps.length > 0 && (
                  <Section title="Content gaps">
                    <div className="space-y-1.5">
                      {analysis.contentGaps.map((g, i) => (
                        <div key={i} className="text-[11px]">
                          <div className="text-ink">{g.topic}</div>
                          <div className="text-[10px] text-ink-faint">covered by {g.coveredBy.map(nameFor).join(", ")}</div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Pricing */}
                {analysis.pricing.length > 0 && (
                  <Section title="Pricing">
                    <div className="space-y-2">
                      {analysis.pricing.map((row) => (
                        <div key={row.domain} className="rounded-lg border border-border bg-bg-card p-2.5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs font-medium">{row.name}</span>
                            {row.isYou && <Pill tone="brand">You</Pill>}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {row.tiers.map((t, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated border border-border text-ink-muted">
                                {t.name}{t.price ? ` · ${t.price}` : ""}{t.period ? ` ${t.period}` : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                <div className="text-[10px] text-ink-faint pt-1">
                  {analysis.competitorsAnalyzed} competitor(s) analyzed · {analysis.source === "ai" ? "AI-assisted" : "local"} synthesis
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 px-4 h-14 border-t border-border-subtle shrink-0">
            <button
              onClick={rerun}
              disabled={rerunning || analyzing}
              className="h-8 px-3 rounded-md text-xs text-ink-muted hover:bg-bg-hover flex items-center gap-1.5 disabled:opacity-50"
            >
              {rerunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Re-run
            </button>
            <button onClick={() => setEditing(true)} className="h-8 px-3 rounded-md bg-bg-elevated border border-border text-xs hover:bg-bg-hover">
              Edit markdown
            </button>
          </div>
        </>
      )}
    </Drawer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-ink-faint mb-1.5">{title}</div>
      {children}
    </div>
  );
}

function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative ml-auto h-full w-full max-w-lg bg-bg-panel border-l border-border flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 h-12 border-b border-border-subtle shrink-0">
          <h3 className="font-semibold text-sm">{title}</h3>
          <button onClick={onClose} className="text-ink-faint hover:text-ink"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DrawerFooter({ onClose, onSave, saving }: { onClose: () => void; onSave: () => void; saving: boolean }) {
  return (
    <div className="flex items-center justify-end gap-2 px-4 h-14 border-t border-border-subtle shrink-0">
      <button onClick={onClose} className="h-8 px-3 rounded-md text-xs text-ink-muted hover:bg-bg-hover">Cancel</button>
      <button onClick={onSave} disabled={saving} className="h-8 px-3 rounded-md bg-brand hover:bg-brand/90 text-white text-xs font-medium flex items-center gap-1.5">
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
      </button>
    </div>
  );
}
