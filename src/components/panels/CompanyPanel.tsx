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

  const doc = dash.documents.find((d) => d.id === openDoc);

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
          <div className="text-[10px] uppercase tracking-wide text-ink-faint px-1 mb-1.5">Competitors</div>
          <div className="space-y-0.5">
            {dash.competitors.map((c) => (
              <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-bg-hover group">
                <span className="w-1.5 h-1.5 rounded-full bg-ink-faint shrink-0" />
                <span className="text-xs flex-1 truncate">{c.domain}</span>
                <button onClick={() => removeCompetitor(c.id)} className="opacity-0 group-hover:opacity-100 text-ink-faint hover:text-bad">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {dash.competitors.length === 0 && (
              <p className="px-2 py-1 text-[11px] text-ink-faint">No competitors yet.</p>
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

      {doc && <DocDrawer doc={doc} onClose={() => setOpenDoc(null)} onSaved={onChange} />}
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
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative ml-auto h-full w-full max-w-lg bg-bg-panel border-l border-border flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 h-12 border-b border-border-subtle">
          <h3 className="font-semibold text-sm">{doc.title}</h3>
          <button onClick={onClose} className="text-ink-faint hover:text-ink"><X className="w-4 h-4" /></button>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 p-4 bg-transparent text-sm leading-relaxed outline-none resize-none scrollbar-thin font-mono"
          placeholder="This document is empty. Add details or run a scan to populate it."
        />
        <div className="flex items-center justify-end gap-2 px-4 h-14 border-t border-border-subtle">
          <button onClick={onClose} className="h-8 px-3 rounded-md text-xs text-ink-muted hover:bg-bg-hover">Cancel</button>
          <button onClick={save} disabled={saving} className="h-8 px-3 rounded-md bg-brand hover:bg-brand/90 text-white text-xs font-medium flex items-center gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}
