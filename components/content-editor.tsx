"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  AlertTriangle, ArrowLeft, Bold, Check, CheckCircle2, ChevronDown, Eye, Heading2, Italic, Link2,
  List, Loader2, Plus, Rocket, Save, Sparkles, Wand2, X, XCircle, Globe2, Lock,
} from "lucide-react";
import type { ContentAnalysis } from "@/lib/analysis";
import type { ContentDoc } from "@/lib/types";
import { analyzeContent } from "@/lib/analysis";
import { fmtNumber, fmtRelative, scoreTone } from "@/lib/format";
import { Badge, Card, Progress, ScoreRing, SectionHeader } from "./ui";

export function NewContentButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [keyword, setKeyword] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, title: title || "Untitled draft", targetKeyword: keyword }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      router.push(`/${projectId}/content/${data.doc.id}`);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary btn-sm"><Plus className="h-3.5 w-3.5" /> New document</button>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <form onSubmit={create} className="w-full max-w-md rounded-2xl border border-line bg-panel p-5 shadow-pop animate-fade-up">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[15px] font-semibold">New content document</h3>
                <p className="mt-1 text-[12px] text-muted">Give it a working title and the keyword you want to rank for. You can change both later.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-faint hover:text-ink"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 space-y-3">
              <div><label className="label">Working title</label><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="input mt-1" placeholder="Best hiking boots for wide feet" /></div>
              <div><label className="label">Focus keyword</label><input value={keyword} onChange={(e) => setKeyword(e.target.value)} className="input mt-1" placeholder="hiking boots" /></div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">Cancel</button>
              <button type="submit" disabled={busy} className="btn-primary btn-sm">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create draft</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

const STATUS_TONE = {
  passive: "border-line bg-raised/50 text-faint",
  pass: "border-brand/30 bg-brand/10 text-brand",
  warn: "border-amber/30 bg-amber/10 text-amber",
  fail: "border-rose/30 bg-rose/10 text-rose",
} as const;

export function ContentEditor({
  doc,
  projectId,
  wordpressConnected,
  initialAnalysis,
  readOnly = false,
}: {
  doc: ContentDoc;
  projectId: string;
  wordpressConnected: boolean;
  initialAnalysis: ContentAnalysis;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(doc.title);
  const [keyword, setKeyword] = useState(doc.targetKeyword);
  const [body, setBody] = useState(doc.body);
  const [metaTitle, setMetaTitle] = useState(doc.title.slice(0, 60));
  const [metaDescription, setMetaDescription] = useState("");
  const [analysis, setAnalysis] = useState<ContentAnalysis>(initialAnalysis);
  const [scoring, setScoring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(doc.updatedAt);
  const [status, setStatus] = useState(doc.status);
  const [notice, setNotice] = useState<string | null>(null);
  const [briefing, setBriefing] = useState(false);
  const [showMeta, setShowMeta] = useState(true);
  const [filter, setFilter] = useState<"all" | "todo">("all");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const runAnalysis = useCallback(async () => {
    setScoring(true);
    try {
      const res = await fetch("/api/content/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, keyword, body, metaTitle, metaDescription }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data.analysis as ContentAnalysis);
      } else {
        setAnalysis(analyzeContent({ title, keyword, body, metaTitle, metaDescription }));
      }
    } catch {
      setAnalysis(analyzeContent({ title, keyword, body, metaTitle, metaDescription }));
    } finally {
      setScoring(false);
    }
  }, [title, keyword, body, metaTitle, metaDescription]);

  useEffect(() => {
    const timer = setTimeout(runAnalysis, 420);
    return () => clearTimeout(timer);
  }, [runAnalysis]);

  const save = async (nextStatus?: typeof status) => {
    setSaving(true);
    const res = await fetch(`/api/content/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, targetKeyword: keyword, body, status: nextStatus ?? status }),
    });
    if (res.ok) {
      const data = await res.json();
      setSavedAt(data.doc.updatedAt);
      setStatus(data.doc.status);
      setNotice(nextStatus === "published" ? "Published and scored — ready for WordPress" : "Draft saved");
      router.refresh();
    }
    setSaving(false);
    setTimeout(() => setNotice(null), 3200);
  };

  const insert = (before: string, after = "", placeholder = "") => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = body.slice(start, end) || placeholder;
    const next = `${body.slice(0, start)}${before}${selected}${after}${body.slice(end)}`;
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = start + before.length + selected.length;
    });
  };

  const tone = scoreTone(analysis.score);
  const todoCount = analysis.checks.filter((c) => c.status !== "pass").length;
  const checks = analysis.checks.filter((c) => (filter === "all" ? true : c.status !== "pass"));
  const groups = ["Meta", "Content", "Structure", "Readability", "Links"] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button onClick={() => router.push(`/${projectId}/content`)} className="btn-ghost btn-xs !px-1.5" aria-label="Back"><ArrowLeft className="h-3.5 w-3.5" /></button>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-w-[220px] flex-1 truncate bg-transparent text-[19px] font-semibold tracking-[-0.02em] outline-none focus:bg-raised/20 rounded px-1"
            placeholder="Document title"
          />
          <Badge tone={status === "published" ? "brand" : status === "optimized" ? "sky" : "outline"}>{status}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden text-[11px] text-faint sm:inline">Saved {fmtRelative(savedAt)}</span>
          {readOnly ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand/25 bg-brand/[0.07] px-2.5 py-1.5 text-[11.5px] text-brand">
              <Lock className="h-3 w-3" /> Read-only guest view
            </span>
          ) : (
            <>
              <button onClick={() => save("optimized")} disabled={saving} className="btn-ghost btn-sm"><Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save draft"}</button>
              <button onClick={() => save("published")} disabled={saving} className="btn-primary btn-sm"><Rocket className="h-3.5 w-3.5" /> Publish</button>
            </>
          )}
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-brand/25 bg-brand/[0.07] px-3 py-2 text-[12px] text-brand">
          <CheckCircle2 className="h-3.5 w-3.5" /> {notice}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-7">
          <Card>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Focus keyword</label>
                <input value={keyword} onChange={(e) => setKeyword(e.target.value)} readOnly={readOnly} className="input mt-1.5 read-only:opacity-70" placeholder="e.g. hiking boots" />
              </div>
              <div>
                <label className="label">Target country</label>
                <select className="select mt-1.5"><option>United States</option><option>United Kingdom</option><option>Canada</option><option>Australia</option><option>Germany</option></select>
              </div>
            </div>
            <button onClick={() => setShowMeta((v) => !v)} className="mt-3 flex w-full items-center justify-between rounded-lg border border-line bg-raised/30 px-3 py-2 text-[12px] text-muted">
              <span className="flex items-center gap-1.5"><Globe2 className="h-3.5 w-3.5" /> SEO meta title & description</span>
              <ChevronDown className={clsx("h-3.5 w-3.5 transition", showMeta && "rotate-180")} />
            </button>
            {showMeta && (
              <div className="mt-3 space-y-3">
                <div>
                  <div className="flex items-center justify-between"><label className="label">Meta title</label><span className={clsx("text-[10.5px] tabular-nums", metaTitle.length > 60 ? "text-rose" : metaTitle.length >= 30 ? "text-brand" : "text-faint")}>{metaTitle.length}/60</span></div>
                  <input value={metaTitle} readOnly={readOnly} onChange={(e) => setMetaTitle(e.target.value)} className="input mt-1 read-only:opacity-70" />
                </div>
                <div>
                  <div className="flex items-center justify-between"><label className="label">Meta description</label><span className={clsx("text-[10.5px] tabular-nums", metaDescription.length > 160 ? "text-rose" : metaDescription.length >= 120 ? "text-brand" : "text-faint")}>{metaDescription.length}/160</span></div>
                  <textarea value={metaDescription} readOnly={readOnly} onChange={(e) => setMetaDescription(e.target.value)} rows={2} className="input mt-1 resize-none read-only:opacity-70" placeholder="Summarise the page in 120–160 characters…" />
                </div>
              </div>
            )}
          </Card>

          <Card padded={false}>
            {!readOnly && <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 py-2">
              <button onClick={() => insert("## ", "\n", "Section heading")} className="btn-ghost btn-xs"><Heading2 className="h-3.5 w-3.5" /> H2</button>
              <button onClick={() => insert("**", "**", "bold text")} className="btn-ghost btn-xs"><Bold className="h-3.5 w-3.5" /></button>
              <button onClick={() => insert("_", "_", "italic text")} className="btn-ghost btn-xs"><Italic className="h-3.5 w-3.5" /></button>
              <button onClick={() => insert("- ", "", "list item")} className="btn-ghost btn-xs"><List className="h-3.5 w-3.5" /></button>
              <button onClick={() => insert("[", "](https://)", "anchor text")} className="btn-ghost btn-xs"><Link2 className="h-3.5 w-3.5" /> Link</button>
              <div className="ml-auto flex items-center gap-2 text-[11px] text-faint">
                <span className="tabular-nums">{fmtNumber(analysis.wordCount)} words</span>
                <span>·</span>
                <span>{analysis.readingTime} min read</span>
                {scoring && <span className="flex items-center gap-1 text-sky"><Loader2 className="h-3 w-3 animate-spin" /> scoring</span>}
              </div>
            </div>}
            <textarea
              ref={bodyRef}
              readOnly={readOnly}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={26}
              spellCheck
              placeholder="Start writing, or paste a draft. Use ## for H2 headings — scoring updates as you type."
              className="w-full resize-y bg-transparent px-4 py-4 text-[13.5px] leading-[1.75] text-ink outline-none placeholder:text-faint"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-[11px] text-faint">
              <span>Markdown supported · scores sync to WordPress on save</span>
              {!readOnly && <div className="flex items-center gap-1.5">
                <button
                  onClick={async () => {
                    setBriefing(true);
                    const res = await fetch("/api/content/brief", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ projectId, keyword, title }),
                    });
                    const data = await res.json();
                    setBriefing(false);
                    if (res.ok) {
                      setBody((prev) => (prev.trim() ? `${prev}\n\n${data.outline}` : data.outline));
                      setNotice(`AI outline generated — ${data.relatedTerms.length} related terms suggested`);
                      setTimeout(() => setNotice(null), 3600);
                    }
                  }}
                  disabled={briefing || !keyword.trim()}
                  className="btn-ghost btn-xs"
                >
                  {briefing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-iris" />} AI outline
                </button>
                <button onClick={() => setBody(`${body}\n\n## Frequently asked questions\n\n### What should I look for?\n\n- Fit and comfort\n- Traction and durability\n- Waterproofing\n`)} className="btn-ghost btn-xs"><Wand2 className="h-3 w-3" /> FAQ block</button>
              </div>}
            </div>
          </Card>

          <Card>
            <SectionHeader title="SERP preview" subtitle="How this page can appear in Google" action={<Eye className="h-3.5 w-3.5 text-faint" />} />
            <div className="mt-4 rounded-xl border border-line bg-bg/50 p-4">
              <div className="flex items-center gap-2 text-[11.5px] text-muted"><Globe2 className="h-3 w-3" /> northwindoutdoors.com › blog › {keyword.replace(/\s+/g, "-")}</div>
              <p className="mt-1 text-[15px] font-medium leading-snug text-[#8AB4F8]">{metaTitle || title || "Meta title preview"}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">{metaDescription || analysis.suggested.description}</p>
            </div>
            {!readOnly && <div className="mt-3 flex flex-wrap items-center gap-2">
              <button onClick={() => setMetaTitle(analysis.suggested.title)} className="btn-soft btn-xs"><Sparkles className="h-3 w-3" /> Use suggested title</button>
              <button onClick={() => setMetaDescription(analysis.suggested.description)} className="btn-soft btn-xs"><Sparkles className="h-3 w-3" /> Use suggested description</button>
              <span className="text-[10.5px] text-faint">Generated from your draft and target keyword</span>
            </div>}
          </Card>
        </div>

        <div className="space-y-4 xl:col-span-5">
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label">Content score</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className={clsx("text-[36px] font-semibold leading-none tracking-[-0.03em] tabular-nums", tone.text)}>{analysis.score}</span>
                  <span className="text-[12px] text-muted">/100</span>
                </div>
                <p className="mt-1.5 text-[12px] font-medium">{analysis.grade}</p>
                <p className="mt-0.5 text-[11px] text-faint">{todoCount} checks to improve</p>
              </div>
              <ScoreRing score={analysis.score} size={78} label="live" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3">
              {[
                { k: "Words", v: fmtNumber(analysis.wordCount) },
                { k: "Readability", v: String(analysis.readability) },
                { k: "Density", v: `${analysis.keywordDensity}%` },
              ].map((s) => (
                <div key={s.k} className="rounded-lg border border-line bg-raised/25 p-2">
                  <p className="text-[10px] uppercase tracking-wider text-faint">{s.k}</p>
                  <p className="mt-0.5 text-[13px] font-semibold tabular-nums">{s.v}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-[10.5px] text-faint"><span>Target 80+</span><span>{analysis.readabilityLabel}</span></div>
              <Progress value={analysis.score} tone={analysis.score >= 80 ? "brand" : analysis.score >= 60 ? "amber" : "rose"} height={5} />
            </div>
          </Card>

          <Card padded={false}>
            <div className="flex items-center justify-between p-4 pb-2">
              <SectionHeader title="Checks" subtitle={`${analysis.checks.filter((c) => c.status === "pass").length}/${analysis.checks.length} passing`} />
              <div className="seg">
                <button onClick={() => setFilter("all")} className={clsx("seg-item !px-2 !py-0.5 !text-[11px]", filter === "all" && "seg-item-active")}>All</button>
                <button onClick={() => setFilter("todo")} className={clsx("seg-item !px-2 !py-0.5 !text-[11px]", filter === "todo" && "seg-item-active")}>To fix</button>
              </div>
            </div>
            <div className="max-h-[360px] overflow-auto px-4 pb-4">
              {groups.map((group) => {
                const list = checks.filter((c) => c.group === group);
                if (!list.length) return null;
                return (
                  <div key={group} className="mt-3">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">{group}</p>
                    <ul className="space-y-1.5">
                      {list.map((c) => (
                        <li key={c.id} className="flex items-start gap-2">
                          {c.status === "pass" ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" /> : c.status === "warn" ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose" />}
                          <div className="min-w-0">
                            <p className={clsx("text-[12px] font-medium", c.status === "pass" ? "text-muted" : "text-ink")}>{c.label}</p>
                            <p className="text-[10.5px] leading-snug text-faint">{c.detail}</p>
                          </div>
                          <span className={clsx("ml-auto shrink-0 rounded border px-1 text-[9.5px] tabular-nums", STATUS_TONE[c.status === "pass" ? "pass" : c.status === "warn" ? "warn" : "fail"])}>{c.earned}/{c.weight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <SectionHeader title="Recommended fixes" subtitle="Ranked by score impact" action={<Badge tone="iris"><Sparkles className="h-3 w-3" /> AI</Badge>} />
            <ul className="mt-3 space-y-2">
              {analysis.recommendations.slice(0, 5).map((r) => (
                <li key={r.id} className="rounded-lg border border-line bg-raised/20 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-medium">{r.title}</p>
                    <span className="shrink-0 rounded border border-brand/25 bg-brand/10 px-1 text-[9.5px] font-semibold text-brand">+{r.points}</span>
                  </div>
                  <p className="mt-0.5 text-[10.5px] leading-snug text-faint">{r.detail}</p>
                </li>
              ))}
              {analysis.recommendations.length === 0 && (
                <li className="flex items-center gap-2 rounded-lg border border-brand/20 bg-brand/[0.06] p-2.5 text-[12px] text-brand"><Check className="h-3.5 w-3.5" /> All checks passing — ready to publish.</li>
              )}
            </ul>
            <div className="mt-3 space-y-1.5 border-t border-line pt-3">
              <p className="label">Topical terms detected</p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.topTerms.slice(0, 8).map((t) => (
                  <span key={t.term} className="chip border-line bg-raised/50 text-[10.5px] text-muted">{t.term} <span className="text-faint">×{t.count}</span></span>
                ))}
              </div>
            </div>
            {!readOnly && <button
              onClick={() => {
                if (!wordpressConnected) {
                  setNotice("Connect WordPress in Project Settings to push this draft.");
                  setTimeout(() => setNotice(null), 3200);
                  return;
                }
                save("published");
              }}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12px] text-muted transition hover:text-ink"
            >
              <Rocket className="h-3.5 w-3.5" /> {wordpressConnected ? "Push to WordPress" : "WordPress not connected"}
            </button>}
          </Card>
        </div>
      </div>
    </div>
  );
}
