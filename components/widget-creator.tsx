"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Code2, Loader2, Plus, X } from "lucide-react";
import type { Widget } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { Badge, Card, SectionHeader } from "./ui";
import { CopyButton } from "./actions";

const TYPES = [
  { key: "rank_snapshot", label: "Rank snapshot", desc: "Average position sparkline" },
  { key: "authority", label: "Authority badge", desc: "Domain rating + referring domains" },
  { key: "keywords", label: "Top keywords", desc: "Live top-5 ranking list" },
  { key: "audit_score", label: "Audit score", desc: "Site health gauge" },
  { key: "local_grid", label: "Local grid", desc: "5×5 local pack heatmap" },
];

export function NewWidgetButton({ projectId, accent }: { projectId: string; accent: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Client dashboard widget");
  const [type, setType] = useState("rank_snapshot");
  const [theme, setTheme] = useState<"dark" | "light" | "auto">("dark");
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/widgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, name, type, theme, accent }),
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary btn-sm"><Plus className="h-3.5 w-3.5" /> New widget</button>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <form onSubmit={create} className="w-full max-w-md rounded-2xl border border-line bg-panel p-5 shadow-pop animate-fade-up">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[15px] font-semibold">Create embeddable widget</h3>
                <p className="mt-1 text-[12px] text-muted">Drop live SEO metrics into any site or client dashboard.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-faint hover:text-ink"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 space-y-3">
              <div><label className="label">Widget name</label><input value={name} onChange={(e) => setName(e.target.value)} className="input mt-1" required /></div>
              <div>
                <label className="label">Type</label>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  {TYPES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setType(t.key)}
                      className={clsx("rounded-lg border px-2 py-1.5 text-left transition", type === t.key ? "border-brand/40 bg-brand/[0.07]" : "border-line hover:bg-raised/40")}
                    >
                      <p className="text-[11.5px] font-medium">{t.label}</p>
                      <p className="text-[10px] text-faint">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Theme</label>
                <div className="seg mt-1.5">
                  {(["dark", "light", "auto"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setTheme(t)} className={clsx("seg-item capitalize", theme === t && "seg-item-active")}>{t}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">Cancel</button>
              <button type="submit" disabled={busy} className="btn-primary btn-sm">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create widget</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export function WidgetCard({ widget, readOnly = false }: { widget: Widget; readOnly?: boolean }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const embed = `<iframe src="${origin}/embed/${widget.publicToken}" width="360" height="230" style="border:0;border-radius:14px;overflow:hidden" loading="lazy" title="${widget.name}"></iframe>`;

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">{widget.name}</p>
          <p className="mt-0.5 text-[11px] capitalize text-muted">{widget.type.replace("_", " ")} · {widget.theme} · {fmtDate(widget.createdAt)}</p>
        </div>
        <Badge tone="brand">Live</Badge>
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-line">
        <iframe src={`/embed/${widget.publicToken}`} title={widget.name} className="h-[210px] w-full" loading="lazy" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <CopyButton text={embed} label="Copy embed" />
        <a href={`/embed/${widget.publicToken}`} target="_blank" rel="noreferrer" className="btn-ghost btn-xs"><Code2 className="h-3 w-3" /> Preview</a>
        {!readOnly && <button
          onClick={async () => {
            if (!window.confirm("Delete this widget? Existing embeds will stop working.")) return;
            setDeleting(true);
            await fetch(`/api/widgets/${widget.id}`, { method: "DELETE" });
            setDeleting(false);
            router.refresh();
          }}
          disabled={deleting}
          className="btn-danger btn-xs ml-auto"
        >
          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Remove
        </button>}
      </div>
      <div className="mt-2 truncate rounded-md border border-line bg-raised/30 px-2 py-1.5 font-mono text-[10px] text-faint">{embed.slice(0, 68)}…</div>
    </Card>
  );
}

export { SectionHeader };
