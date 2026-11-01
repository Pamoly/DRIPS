"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, UserRound } from "lucide-react";
import clsx from "clsx";

const DEMO_USERS = [
  { email: "avery@drips.app", name: "Avery Chen", role: "Owner", note: "Full access" },
  { email: "priya@drips.app", name: "Priya Patel", role: "Admin", note: "Strategy + integrations" },
  { email: "marcus@drips.app", name: "Marcus Reed", role: "Editor", note: "Content workflows" },
  { email: "jonas@client.com", name: "Jonas Weber", role: "Viewer", note: "Client seat" },
];

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("avery@drips.app");
  const [password, setPassword] = useState("drips2026");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [guestBusy, setGuestBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sign in failed");
      router.push(data.redirect ?? "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setBusy(false);
    }
  };

  const continueAsGuest = async () => {
    setGuestBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/guest", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Guest session unavailable");
      router.push(data.redirect ?? "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Guest session unavailable");
      setGuestBusy(false);
    }
  };

  return (
    <div className="w-full max-w-[380px]">
      <div className="mb-6 lg:hidden">
        <span className="text-[17px] font-semibold tracking-[-0.02em]">DRIPS<span className="text-brand">.</span></span>
      </div>
      <h2 className="text-[21px] font-semibold tracking-[-0.02em]">Sign in to your workspace</h2>
      <p className="mt-1.5 text-[12.5px] text-muted">Use a demo seat below, or your work email and password.</p>

      <button
        type="button"
        onClick={continueAsGuest}
        disabled={guestBusy}
        className="btn-ghost mt-5 w-full !justify-between !py-2.5"
      >
        <span className="flex items-center gap-2">
          {guestBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4 text-brand" />}
          <span className="font-medium">{guestBusy ? "Starting guest session…" : "Continue as guest"}</span>
        </span>
        <span className="text-[10.5px] uppercase tracking-wider text-faint">Read-only</span>
      </button>
      <p className="mt-1.5 text-center text-[10.5px] text-faint">
        Explore all three demo projects instantly · no account needed
      </p>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[10px] uppercase tracking-[0.14em] text-faint">or sign in</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={submit} className="space-y-3.5">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <div className="relative mt-1.5">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input pl-9"
              placeholder="you@company.com"
              required
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="password">Password</label>
            <span className="text-[11px] text-faint">Demo: drips2026</span>
          </div>
          <div className="relative mt-1.5">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pl-9 pr-9"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-muted"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        {error && <p className="rounded-lg border border-rose/25 bg-rose/10 px-3 py-2 text-[12px] text-rose">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full !py-2.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[10px] uppercase tracking-[0.14em] text-faint">Demo seats</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <ul className="space-y-1.5">
        {DEMO_USERS.map((u) => (
          <li key={u.email}>
            <button
              type="button"
              onClick={() => {
                setEmail(u.email);
                setPassword("drips2026");
                setError(null);
              }}
              className={clsx(
                "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition",
                email === u.email ? "border-brand/40 bg-brand/[0.06]" : "border-line bg-surface/60 hover:bg-raised/60",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium">{u.name}</p>
                <p className="text-[11px] text-faint">{u.email}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-medium text-muted">{u.role}</p>
                <p className="text-[10px] text-faint">{u.note}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[10.5px] leading-relaxed text-faint">
        <ShieldCheck className="h-3 w-3 shrink-0" /> Sessions are signed, HTTP-only cookies. Guest sessions are read-only —
        sign in to run audits, edit content or send reports.
      </p>
    </div>
  );
}
