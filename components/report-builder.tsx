"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Loader2, Lock, Plus, Save, X } from "lucide-react";
import type { Report } from "@/lib/types";
import { Card, SectionHeader, Toggle } from "./ui";
import { CopyButton } from "./actions";

const ALL_SECTIONS = [
  { key: "visibility", label: "Visibility overview" },
  { key: "rankings", label: "Ranking performance" },
  { key: "gsc", label: "Search Console" },
  { key: "keywords", label: "Top keywords" },
  { key: "audits", label: "Site health" },
  { key: "backlinks", label: "Backlink profile" },
  { key: "competitors", label: "Competitor benchmark" },
];

export function NewReportButton({ projectId, clientName, accent }: { projectId: string; clientName: string; accent: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Monthly performance review");
  const [period, setPeriod] = useState<Report["period"]>("Last 30 days");
  const [sections, setSections] = useState<string[]>(["visibility", "rankings", "gsc", "keywords", "audits"]);
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, name, clientName, period, sections, accent }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      router.push(`/${projectId}/reports/${data.report.id}`);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary btn-sm"><Plus className="h-3.5 w-3.5" /> New report</button>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <form onSubmit={create} className="w-full max-w-lg rounded-2xl border border-line bg-panel p-5 shadow-pop animate-fade-up">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[15px] font-semibold">Create client report</h3>
                <p className="mt-1 text-[12px] text-muted">White-label, brandable, and shareable via a public link.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-faint hover:text-ink"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 space-y-3">
              <div><label className="label">Report name</label><input value={name} onChange={(e) => setName(e.target.value)} className="input mt-1" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Client</label><input value={clientName} disabled className="input mt-1 opacity-70" /></div>
                <div>
                  <label className="label">Period</label>
                  <select className="select mt-1" value={period} onChange={(e) => setPeriod(e.target.value as Report["period"])}>
                    {["Last 7 days", "Last 30 days", "Last 90 days"].map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Sections</label>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  {ALL_SECTIONS.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setSections((prev) => (prev.includes(s.key) ? prev.filter((x) => x !== s.key) : [...prev, s.key]))}
                      className={clsx(
                        "flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[11.5px] transition",
                        sections.includes(s.key) ? "border-brand/35 bg-brand/[0.07] text-ink" : "border-line text-muted hover:text-ink",
                      )}
                    >
                      <span className={clsx("grid h-3.5 w-3.5 place-items-center rounded border", sections.includes(s.key) ? "border-brand bg-brand text-brand-ink" : "border-line")}>
                        {sections.includes(s.key) && <Check className="h-2.5 w-2.5" />}
                      </span>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">Cancel</button>
              <button type="submit" disabled={busy} className="btn-primary btn-sm">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export function ReportSettings({ report, readOnly = false }: { report: Report; readOnly?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(report.name);
  const [clientName, setClientName] = useState(report.clientName);
  const [period, setPeriod] = useState(report.period);
  const [sections, setSections] = useState<string[]>(report.sections);
  const [accent, setAccent] = useState(report.accent);
  const [logoText, setLogoText] = useState(report.logoText);
  const [footerNote, setFooterNote] = useState(report.footerNote);
  const [scheduleEnabled, setScheduleEnabled] = useState(report.schedule.enabled);
  const [frequency, setFrequency] = useState(report.schedule.frequency);
  const [recipients, setRecipients] = useState(report.schedule.recipients.join(", "));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const save = async () => {
    setBusy(true);
    await fetch(`/api/reports/${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        clientName,
        period,
        sections,
        accent,
        logoText,
        footerNote,
        schedule: {
          enabled: scheduleEnabled,
          frequency,
          recipients: recipients.split(",").map((r) => r.trim()).filter(Boolean),
        },
      }),
    });
    setBusy(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2200);
  };

  const url = `${origin}/r/${report.publicToken}`;

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader
          title="Report settings"
          subtitle="Branding and content configuration"
          action={
            readOnly ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand/25 bg-brand/[0.07] px-2 py-1 text-[11px] text-brand">
                <Lock className="h-3 w-3" /> Read-only
              </span>
            ) : (
              <button onClick={save} disabled={busy} className="btn-primary btn-sm">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />} {saved ? "Saved" : "Save"}</button>
            )
          }
        />
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Report name</label><input value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} className="input mt-1" /></div>
            <div><label className="label">Client name</label><input value={clientName} disabled={readOnly} onChange={(e) => setClientName(e.target.value)} className="input mt-1" /></div>
            <div>
              <label className="label">Reporting period</label>
              <select disabled={readOnly} className="select mt-1 disabled:opacity-60" value={period} onChange={(e) => setPeriod(e.target.value as Report["period"])}>
                {["Last 7 days", "Last 30 days", "Last 90 days"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Accent colour</label>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" disabled={readOnly} value={accent} onChange={(e) => setAccent(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-bg" />
                <input value={accent} disabled={readOnly} onChange={(e) => setAccent(e.target.value)} className="input disabled:opacity-60" />
              </div>
            </div>
            <div><label className="label">Logo text</label><input value={logoText} disabled={readOnly} onChange={(e) => setLogoText(e.target.value)} className="input mt-1" /></div>
            <div><label className="label">Footer note</label><input value={footerNote} disabled={readOnly} onChange={(e) => setFooterNote(e.target.value)} className="input mt-1" /></div>
          </div>
          <div>
            <label className="label">Included sections</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ALL_SECTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSections((prev) => (prev.includes(s.key) ? prev.filter((x) => x !== s.key) : [...prev, s.key]))}
                  className={clsx("chip transition", sections.includes(s.key) ? "border-brand/30 bg-brand/10 text-brand" : "border-line bg-raised/40 text-muted hover:text-ink")}
                >
                  {sections.includes(s.key) && <Check className="h-2.5 w-2.5" />} {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Scheduled delivery" subtitle="Automated email to your client list" action={<Toggle checked={scheduleEnabled} onChange={readOnly ? undefined : setScheduleEnabled} label="Enable schedule" />} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Frequency</label>
            <select disabled={readOnly} className="select mt-1 disabled:opacity-60" value={frequency} onChange={(e) => setFrequency(e.target.value as "weekly" | "monthly")}>
              <option value="weekly">Weekly · Mon 08:00</option>
              <option value="monthly">Monthly · 1st 08:00</option>
            </select>
          </div>
          <div>
            <label className="label">Recipients</label>
            <input value={recipients} disabled={readOnly} onChange={(e) => setRecipients(e.target.value)} placeholder="client@example.com, you@agency.com" className="input mt-1" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-raised/30 p-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-faint">Public link</p>
            <p className="truncate text-[12px] text-muted">{url}</p>
          </div>
          <CopyButton text={url} label="Copy link" />
        </div>
      </Card>
    </div>
  );
}
