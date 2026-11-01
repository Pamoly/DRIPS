"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Loader2, Lock, Plus, Save, Trash2 } from "lucide-react";
import type { Project } from "@/lib/types";
import { Card, SectionHeader } from "./ui";

export function ProjectSettingsForm({ project, readOnly = false }: { project: Project; readOnly?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [country, setCountry] = useState(project.country);
  const [language, setLanguage] = useState(project.language);
  const [brandColor, setBrandColor] = useState(project.brandColor);
  const [schedule, setSchedule] = useState(project.clientReportSchedule);
  const [competitors, setCompetitors] = useState<string[]>(project.competitors);
  const [newCompetitor, setNewCompetitor] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, country, language, brandColor, clientReportSchedule: schedule, competitors }),
    });
    setBusy(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2400);
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <Card>
        <SectionHeader
          title="Project details"
          subtitle="Markets, branding and reporting defaults"
          action={
            readOnly ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand/25 bg-brand/[0.07] px-2 py-1 text-[11px] text-brand">
                <Lock className="h-3 w-3" /> Read-only
              </span>
            ) : (
              <button type="submit" disabled={busy} className="btn-primary btn-sm">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}{saved ? "Saved" : "Save changes"}</button>
            )
          }
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><label className="label">Project name</label><input value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} className="input mt-1 disabled:opacity-60" /></div>
          <div><label className="label">Domain</label><input value={project.domain} disabled className="input mt-1 opacity-60" /></div>
          <div>
            <label className="label">Primary market</label>
            <select value={country} disabled={readOnly} onChange={(e) => setCountry(e.target.value)} className="select mt-1 disabled:opacity-60">
              {["United States", "United Kingdom", "Canada", "Australia", "Germany", "Netherlands", "France", "Spain"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Language</label>
            <select value={language} disabled={readOnly} onChange={(e) => setLanguage(e.target.value)} className="select mt-1 disabled:opacity-60">
              {["English", "German", "Dutch", "French", "Spanish"].map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Brand accent</label>
            <div className="mt-1 flex items-center gap-2">
              <input type="color" disabled={readOnly} value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-bg" />
              <input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Client report cadence</label>
            <select value={schedule} disabled={readOnly} onChange={(e) => setSchedule(e.target.value as typeof schedule)} className="select mt-1 disabled:opacity-60">
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="off">Manual only</option>
            </select>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Tracked competitors" subtitle="Domains benchmarked in competitor intelligence" />
        <div className="mt-4 space-y-1.5">
          {competitors.map((c) => (
            <div key={c} className="flex items-center gap-2 rounded-lg border border-line bg-raised/20 px-3 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-iris" />
              <span className="flex-1 text-[12px]">{c}</span>
              {!readOnly && <button type="button" onClick={() => setCompetitors((prev) => prev.filter((x) => x !== c))} className="text-faint hover:text-rose"><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>
          ))}
        </div>
        {!readOnly && <div className="mt-3 flex gap-2">
          <input value={newCompetitor} onChange={(e) => setNewCompetitor(e.target.value)} placeholder="competitor.com" className="input" />
          <button
            type="button"
            onClick={() => {
              const v = newCompetitor.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
              if (!v) return;
              setCompetitors((prev) => (prev.includes(v) ? prev : [...prev, v]));
              setNewCompetitor("");
            }}
            className="btn-soft btn-sm shrink-0"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>}
        <p className="mt-2 text-[11px] text-faint">Changes to competitors take effect on the next daily refresh.</p>
      </Card>
    </form>
  );
}

export function ColorSwatches({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const colors = ["#4ADE80", "#38BDF8", "#818CF8", "#FBBF24", "#FB7185", "#A78BFA", "#22D3EE"];
  return (
    <div className="flex gap-1.5">
      {colors.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} className={clsx("h-6 w-6 rounded-md border-2 transition", value === c ? "border-ink" : "border-transparent")} style={{ background: c }} aria-label={c} />
      ))}
    </div>
  );
}
