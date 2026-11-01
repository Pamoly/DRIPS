"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, PlayCircle, RefreshCw, Send, Trash2, TrendingUp } from "lucide-react";
import clsx from "clsx";

export function RefreshRanksButton({ projectId, label = "Refresh rankings" }: { projectId: string; label?: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [updated, setUpdated] = useState(0);

  const run = async () => {
    setState("busy");
    try {
      const res = await fetch("/api/rank/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUpdated(data.updated);
      setState("done");
      router.refresh();
      setTimeout(() => setState("idle"), 2600);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2600);
    }
  };

  return (
    <button onClick={run} disabled={state === "busy"} className="btn-soft btn-sm">
      {state === "busy" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : state === "done" ? <Check className="h-3.5 w-3.5 text-brand" /> : <RefreshCw className="h-3.5 w-3.5" />}
      {state === "busy" ? "Pulling SERPs…" : state === "done" ? `${updated} updated` : state === "error" ? "Try again" : label}
    </button>
  );
}

export function RunAuditButton({ projectId, className, label = "Run site audit" }: { projectId: string; className?: string; label?: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "crawling" | "error">("idle");
  const [progress, setProgress] = useState(0);

  const run = async () => {
    setState("crawling");
    setProgress(8);
    const timer = setInterval(() => setProgress((p) => Math.min(92, p + Math.random() * 16)), 420);
    try {
      const res = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      clearInterval(timer);
      if (!res.ok) throw new Error(data.error);
      setProgress(100);
      router.refresh();
      setTimeout(() => {
        router.push(`/${projectId}/audits/${data.audit.id}`);
        setState("idle");
        setProgress(0);
      }, 300);
    } catch {
      clearInterval(timer);
      setState("error");
      setTimeout(() => setState("idle"), 2500);
    }
  };

  return (
    <button onClick={run} disabled={state === "crawling"} className={clsx("btn-primary btn-sm relative overflow-hidden", className)}>
      {state === "crawling" && (
        <span className="absolute inset-y-0 left-0 bg-white/20 transition-all duration-300" style={{ width: `${progress}%` }} />
      )}
      <span className="relative flex items-center gap-1.5">
        {state === "crawling" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
        {state === "crawling" ? `Crawling ${Math.round(progress)}%` : state === "error" ? "Retry crawl" : label}
      </span>
    </button>
  );
}

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className={clsx("btn-soft btn-xs", className)}
    >
      {copied ? <Check className="h-3 w-3 text-brand" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

export function SendReportButton({ reportId, label = "Send now" }: { reportId: string; label?: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const send = async () => {
    setState("busy");
    const res = await fetch(`/api/reports/${reportId}/send`, { method: "POST" });
    setState(res.ok ? "done" : "idle");
    router.refresh();
    setTimeout(() => setState("idle"), 2400);
  };
  return (
    <button onClick={send} disabled={state === "busy"} className="btn-primary btn-sm">
      {state === "busy" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : state === "done" ? <Check className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
      {state === "busy" ? "Sending…" : state === "done" ? "Sent" : label}
    </button>
  );
}

export function ActionButton({
  endpoint,
  method = "POST",
  body,
  children,
  className = "btn-ghost btn-sm",
  pendingLabel = "Working…",
  onDone,
}: {
  endpoint: string;
  method?: "POST" | "PATCH" | "DELETE";
  body?: unknown;
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  onDone?: (data: unknown) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending] = useTransition();
  return (
    <button
      className={className}
      disabled={busy || isPending}
      title={error ?? undefined}
      onClick={async () => {
        setBusy(true);
        setError(null);
        try {
          const res = await fetch(endpoint, {
            method,
            headers: { "Content-Type": "application/json" },
            body: body ? JSON.stringify(body) : undefined,
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error ?? "Request failed");
          onDone?.(data);
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Request failed");
          setTimeout(() => setError(null), 3000);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
      {busy ? pendingLabel : null}
    </button>
  );
}

export function DeleteButton({
  endpoint,
  confirmText = "Delete this item?",
  label,
}: {
  endpoint: string;
  confirmText?: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-danger btn-xs"
      onClick={async () => {
        if (!window.confirm(confirmText)) return;
        setBusy(true);
        await fetch(endpoint, { method: "DELETE" });
        setBusy(false);
        router.refresh();
      }}
      aria-label="Delete"
      title="Delete"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      {label}
    </button>
  );
}

export function TrackToggle({ keywordId, tracked }: { keywordId: string; tracked: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(tracked);
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        const next = !on;
        setOn(next);
        await fetch(`/api/keywords/${keywordId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tracked: next }),
        });
        setBusy(false);
        router.refresh();
      }}
      disabled={busy}
      className={clsx(
        "inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] transition",
        on ? "border-brand/30 bg-brand/10 text-brand" : "border-line bg-raised/50 text-faint hover:text-muted",
      )}
      title={on ? "Stop tracking" : "Track keyword"}
    >
      <TrendingUp className="h-3 w-3" />
      {on ? "Tracked" : "Track"}
    </button>
  );
}
