"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  Activity, Bell, BookOpen, ChevronDown, ChevronsUpDown, Command, FileText, Globe2, LayoutDashboard,
  LineChart, Link2, ListChecks, LogOut, Menu, Moon, PenLine, Plus, ScanSearch, Search, Settings,
  Swords, Sun, TrendingUp, Users, X, Sparkles, Code2, Check, ArrowRight, Plug, LayoutTemplate, ShieldCheck,
} from "lucide-react";
import type { Project, SessionUser } from "@/lib/types";
import { Avatar } from "./ui";

type NavItem = { href: string; label: string; icon: React.ElementType; badge?: string };
type NavGroup = { title: string; items: NavItem[] };

export type SearchEntry = { label: string; hint: string; href: string; type: string };

export function AppShell({
  user,
  projects,
  project,
  children,
  searchIndex,
  notifications,
  openTasks = 0,
}: {
  user: SessionUser;
  projects: Pick<Project, "id" | "name" | "domain" | "color">[];
  project: Project;
  children: React.ReactNode;
  searchIndex: SearchEntry[];
  notifications: { id: string; title: string; body: string; at: string }[];
  openTasks?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = (typeof window !== "undefined" && localStorage.getItem("drips-theme")) || "dark";
    setTheme(stored === "light" ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", stored === "light" ? "light" : "dark");
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("drips-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const groups: NavGroup[] = useMemo(
    () => [
      { title: "Overview", items: [{ href: "", label: "Dashboard", icon: LayoutDashboard }] },
      {
        title: "Research",
        items: [
          { href: "/keywords", label: "Keyword Explorer", icon: Search },
          { href: "/competitors", label: "Competitors", icon: Swords },
          { href: "/backlinks", label: "Backlinks", icon: Link2 },
        ],
      },
      {
        title: "Monitoring",
        items: [
          { href: "/rank-tracker", label: "Rank Tracker", icon: TrendingUp },
          { href: "/search-console", label: "Search Console", icon: LineChart },
          { href: "/ai-visibility", label: "AI Visibility", icon: Sparkles },
        ],
      },
      {
        title: "Site health",
        items: [
          { href: "/audits", label: "Site Audits", icon: ScanSearch },
          { href: "/content", label: "Content Optimizer", icon: PenLine },
          { href: "/wordpress", label: "WordPress", icon: Plug },
        ],
      },
      {
        title: "Deliver",
        items: [
          { href: "/reports", label: "Reports", icon: FileText },
          { href: "/widgets", label: "Widgets", icon: LayoutTemplate },
        ],
      },
      {
        title: "Team",
        items: [
          { href: "/tasks", label: "Tasks", icon: ListChecks },
          { href: "/team", label: "Team & Clients", icon: Users },
          { href: "/settings", label: "Project Settings", icon: Settings },
        ],
      },
    ],
    [],
  );

  const activeLabel = useMemo(() => {
    const seg = pathname.split("/")[2] ?? "";
    for (const g of groups) for (const item of g.items) if (item.href.replace("/", "") === seg) return item.label;
    return "Dashboard";
  }, [pathname, groups]);

  return (
    <div className="ambient relative min-h-screen">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-line bg-surface/95 backdrop-blur transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between gap-2 border-b border-line px-4">
          <Link href={`/${project.id}`} className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-brand/15 ring-1 ring-brand/30">
              <DropletMark />
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.02em]">
              DRIPS<span className="text-brand">.</span>
            </span>
          </Link>
          <button className="text-muted lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
            <X className="h-4 w-4" />
          </button>
        </div>

        <ProjectSwitcher projects={projects} current={project} />

        <nav className="scroll-area flex-1 px-2.5 py-3">
          {groups.map((group) => (
            <div key={group.title} className="mb-3.5">
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint/80">{group.title}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const href = `/${project.id}${item.href}`;
                  const active = item.href === "" ? pathname === `/${project.id}` : pathname.startsWith(href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link href={href} className={clsx("sidebar-link", active && "sidebar-link-active")}>
                        <Icon className={clsx("h-[15px] w-[15px] shrink-0", active ? "text-brand" : "text-faint group-hover:text-muted")} strokeWidth={1.9} />
                        <span className="truncate">{item.label}</span>
                        {item.href === "/tasks" && openTasks > 0 && (
                          <span className="ml-auto rounded bg-amber/15 px-1.5 py-px text-[10px] font-semibold text-amber">{openTasks}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-2.5">
          <Link
            href={`/${project.id}/settings`}
            className="mb-2 flex items-center gap-2 rounded-lg border border-line bg-raised/40 px-2.5 py-2 text-[11.5px] text-muted transition hover:text-ink"
          >
            <span className={clsx("h-1.5 w-1.5 rounded-full", project.gsc.connected ? "bg-brand" : "bg-faint")} />
            GSC {project.gsc.connected ? "connected" : "not connected"}
            <span className="mx-0.5 h-3 w-px bg-line" />
            <span className={clsx("h-1.5 w-1.5 rounded-full", project.wp.connected ? "bg-brand" : "bg-faint")} />
            WP {project.wp.connected ? "live" : "off"}
          </Link>
          <UserMenu user={user} projectId={project.id} />
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-md sm:px-6">
          <button className="text-muted lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden items-center gap-2 text-[12.5px] text-muted sm:flex">
            <Globe2 className="h-3.5 w-3.5 text-faint" />
            <span className="max-w-[180px] truncate">{project.domain}</span>
            <span className="text-faint">/</span>
            <span className="font-medium text-ink">{activeLabel}</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] text-faint transition hover:text-muted sm:flex"
            >
              <Search className="h-3.5 w-3.5" />
              Search anything
              <span className="kbd ml-6">⌘K</span>
            </button>
            <button className="btn-ghost btn-sm !px-2 sm:hidden" onClick={() => setPaletteOpen(true)} aria-label="Search">
              <Search className="h-4 w-4" />
            </button>
            <NotificationBell notifications={notifications} />
            <button onClick={toggleTheme} className="btn-ghost btn-sm !px-2" aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="ml-1 hidden items-center gap-2 border-l border-line pl-2.5 sm:flex">
              <Avatar name={user.name} hue={user.hue} size={26} />
              <div className="leading-tight">
                <div className="text-[12px] font-medium">{user.name}</div>
                <div className="text-[10px] uppercase tracking-wide text-faint">{user.isGuest ? "guest · read-only" : user.role}</div>
              </div>
            </div>
          </div>
        </header>
        {user.isGuest && <GuestStrip />}
        <main className="relative mx-auto w-full max-w-[1560px] px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>

      {paletteOpen && (
        <CommandPalette
          entries={searchIndex}
          projects={projects}
          projectId={project.id}
          onClose={() => setPaletteOpen(false)}
          onNavigate={(href) => {
            setPaletteOpen(false);
            router.push(href);
          }}
        />
      )}
    </div>
  );
}

function GuestStrip() {
  return (
    <div className="border-b border-brand/20 bg-brand/[0.06]">
      <div className="mx-auto flex w-full max-w-[1560px] flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 text-[11.5px] sm:px-6">
        <span className="inline-flex items-center gap-1.5 font-medium text-brand">
          <ShieldCheck className="h-3.5 w-3.5" /> Guest mode
        </span>
        <span className="text-muted">
          You&apos;re exploring a live demo of all three projects, read-only. Sign in to run audits, edit content, send
          reports or invite teammates.
        </span>
        <Link href="/login" className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-brand/30 bg-brand/10 px-2 py-0.5 font-medium text-brand transition hover:bg-brand/15">
          Sign in <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function DropletMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#4ADE80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.7c3.6 4.3 6.4 7.7 6.4 11.1a6.4 6.4 0 0 1-12.8 0c0-3.4 2.8-6.8 6.4-11.1Z" />
      <path d="M9.2 14.2a2.8 2.8 0 0 0 2.8 2.8" />
    </svg>
  );
}

function ProjectSwitcher({
  projects,
  current,
}: {
  projects: Pick<Project, "id" | "name" | "domain" | "color">[];
  current: Project;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative border-b border-line p-2.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-raised/40 px-2.5 py-2 text-left transition hover:bg-raised"
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[10px] font-bold" style={{ background: `${current.color}22`, color: current.color }}>
          {current.name.slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-medium">{current.name}</span>
          <span className="block truncate text-[10.5px] text-faint">{current.domain}</span>
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-faint" />
      </button>
      {open && (
        <div className="absolute left-2.5 right-2.5 top-[calc(100%-2px)] z-50 overflow-hidden rounded-xl border border-line bg-panel p-1 shadow-pop animate-fade-up">
          <p className="px-2 py-1.5 text-[10px] uppercase tracking-[0.12em] text-faint">Projects</p>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setOpen(false);
                router.push(`/${p.id}`);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] transition hover:bg-raised"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.id === current.id && <Check className="h-3.5 w-3.5 text-brand" />}
            </button>
          ))}
          <div className="my-1 h-px bg-line" />
          <button
            onClick={() => {
              setOpen(false);
              setCreating(true);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-muted transition hover:bg-raised hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" /> New project
          </button>
        </div>
      )}
      {creating && <NewProjectModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function NewProjectModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [country, setCountry] = useState("United States");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, domain, country }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not create project");
      return;
    }
    onClose();
    router.push(`/${data.project.id}`);
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-line bg-panel p-5 shadow-pop animate-fade-up">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-[15px] font-semibold">New project</h3>
            <p className="mt-1 text-[12px] text-muted">Track a domain, connect Search Console, and invite your team.</p>
          </div>
          <button type="button" onClick={onClose} className="text-faint hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <label className="label">Project name</label>
            <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Outdoors" required />
          </div>
          <div>
            <label className="label">Domain</label>
            <input className="input mt-1" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acme.com" required />
          </div>
          <div>
            <label className="label">Primary market</label>
            <select className="select mt-1" value={country} onChange={(e) => setCountry(e.target.value)}>
              {["United States", "United Kingdom", "Canada", "Australia", "Germany", "Netherlands", "France", "Spain"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-[12px] text-rose">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary">{busy ? "Creating…" : "Create project"}</button>
        </div>
      </form>
    </div>
  );
}

function NotificationBell({ notifications }: { notifications: { id: string; title: string; body: string; at: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="btn-ghost btn-sm relative !px-2" aria-label="Notifications">
        <Bell className="h-4 w-4" />
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand ring-2 ring-bg" />
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-80 overflow-hidden rounded-xl border border-line bg-panel shadow-pop animate-fade-up">
          <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
            <span className="text-[12.5px] font-medium">Notifications</span>
            <span className="chip border-brand/25 bg-brand/10 text-brand">{notifications.length} new</span>
          </div>
          <ul className="max-h-80 overflow-auto">
            {notifications.map((n) => (
              <li key={n.id} className="border-b border-line/60 px-3.5 py-2.5 last:border-0 hover:bg-raised/40">
                <p className="text-[12px] font-medium">{n.title}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{n.body}</p>
              </li>
            ))}
          </ul>
          <div className="border-t border-line p-2">
            <Link href="#" onClick={() => setOpen(false)} className="flex items-center justify-between rounded-md px-2 py-1.5 text-[12px] text-muted hover:text-ink">
              View activity feed <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function UserMenu({ user, projectId }: { user: SessionUser; projectId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-raised">
        <Avatar name={user.name} hue={user.hue} size={24} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-medium">{user.name}</span>
          <span className="block truncate text-[10px] text-faint">{user.email}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" />
      </button>
      {open && (
        <div className="absolute bottom-[calc(100%+6px)] left-0 right-0 z-50 overflow-hidden rounded-xl border border-line bg-panel p-1 shadow-pop animate-fade-up">
          <div className="px-2 py-1.5 text-[11px] text-faint">{user.title}</div>
          <div className="h-px bg-line" />
          {!user.isGuest && (
            <Link href={`/${projectId}/settings`} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-muted hover:bg-raised hover:text-ink">
              <Settings className="h-3.5 w-3.5" /> Account settings
            </Link>
          )}
          {user.isGuest && (
            <Link href="/login" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-brand hover:bg-brand/10">
              <ShieldCheck className="h-3.5 w-3.5" /> Sign in for full access
            </Link>
          )}
          <Link href="/docs" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-muted hover:bg-raised hover:text-ink">
            <BookOpen className="h-3.5 w-3.5" /> Help & docs
          </Link>
          <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] text-rose hover:bg-rose/10">
            <LogOut className="h-3.5 w-3.5" /> {user.isGuest ? "Exit guest session" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

function CommandPalette({
  entries,
  projects,
  projectId,
  onClose,
  onNavigate,
}: {
  entries: SearchEntry[];
  projects: Pick<Project, "id" | "name" | "domain" | "color">[];
  projectId: string;
  onClose: () => void;
  onNavigate: (href: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? entries.filter((e) => `${e.label} ${e.hint} ${e.type}`.toLowerCase().includes(q))
      : entries;
    return base.slice(0, 30);
  }, [entries, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(results.length - 1, c + 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    }
    if (e.key === "Enter" && results[cursor]) {
      onNavigate(results[cursor].href);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-panel shadow-pop animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search className="h-4 w-4 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search keywords, pages, competitors, actions…"
            className="h-12 w-full bg-transparent text-[13px] outline-none placeholder:text-faint"
          />
          <button onClick={onClose} className="kbd">ESC</button>
        </div>
        <div className="max-h-[52vh] overflow-auto p-1.5">
          {!query && (
            <>
              <p className="px-2 py-1.5 text-[10px] uppercase tracking-[0.12em] text-faint">Projects</p>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onNavigate(`/${p.id}`)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-muted hover:bg-raised hover:text-ink"
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
                  {p.name}
                  <span className="ml-auto text-[11px] text-faint">{p.domain}</span>
                </button>
              ))}
              <p className="px-2 pb-1.5 pt-2 text-[10px] uppercase tracking-[0.12em] text-faint">Suggested</p>
            </>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.href}-${r.label}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => onNavigate(r.href)}
              className={clsx(
                "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[12.5px]",
                i === cursor ? "bg-raised text-ink" : "text-muted",
              )}
            >
              <span className="w-12 shrink-0 text-[9px] uppercase tracking-wider text-faint">{r.type}</span>
              <span className="min-w-0 flex-1 truncate">{r.label}</span>
              <span className="shrink-0 truncate text-[11px] text-faint">{r.hint}</span>
            </button>
          ))}
          {results.length === 0 && (
            <div className="px-3 py-8 text-center text-[12.5px] text-muted">
              No matches for <span className="text-ink">“{query}”</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[10.5px] text-faint">
          <span className="flex items-center gap-1"><Command className="h-3 w-3" />K to open</span>
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span className="ml-auto flex items-center gap-1"><Activity className="h-3 w-3" /> live workspace</span>
        </div>
      </div>
    </div>
  );
}

export { DropletMark };
