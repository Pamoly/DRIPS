"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { CalendarDays, CheckCircle2, Circle, Clock, Loader2, Plus, Trash2, User as UserIcon, X } from "lucide-react";
import type { Task, TaskStatus, User } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { Avatar, Badge, Card, SectionHeader } from "./ui";

const COLUMNS: { status: TaskStatus; label: string; tone: string }[] = [
  { status: "todo", label: "To do", tone: "bg-faint" },
  { status: "in_progress", label: "In progress", tone: "bg-sky" },
  { status: "review", label: "In review", tone: "bg-amber" },
  { status: "done", label: "Done", tone: "bg-brand" },
];

const PRIORITY_TONE = {
  high: "border-rose/30 bg-rose/10 text-rose",
  medium: "border-amber/30 bg-amber/10 text-amber",
  low: "border-line bg-raised/60 text-muted",
} as const;

export function TasksBoard({
  projectId,
  tasks,
  users,
  currentUserId,
  canEdit,
}: {
  projectId: string;
  tasks: Task[];
  users: Pick<User, "id" | "name" | "hue" | "title">[];
  currentUserId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(tasks);
  const [assignee, setAssignee] = useState("all");
  const [priority, setPriority] = useState("all");
  const [open, setOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(
    () => items.filter((t) => (assignee === "all" || t.assigneeId === assignee) && (priority === "all" || t.priority === priority)),
    [items, assignee, priority],
  );

  const move = async (id: string, status: TaskStatus) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this task?")) return;
    setItems((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    router.refresh();
  };

  const create = async (payload: { title: string; description: string; assigneeId: string; priority: string; due: string; tag: string }) => {
    setBusy(true);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, ...payload }),
    });
    if (res.ok) {
      const data = await res.json();
      setItems((prev) => [data.task, ...prev]);
      setOpen(false);
      router.refresh();
    }
    setBusy(false);
  };

  const overdue = (t: Task) => t.status !== "done" && new Date(t.due).getTime() < Date.now();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select className="select !w-auto !py-1.5 text-[12px]" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="all">All assignees</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select className="select !w-auto !py-1.5 text-[12px]" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="all">Any priority</option>
          <option value="high">High priority</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <span className="text-[11.5px] text-faint">{filtered.length} tasks</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            {users.slice(0, 4).map((u) => <Avatar key={u.id} name={u.name} hue={u.hue} size={22} />)}
          </div>
          {canEdit && <button onClick={() => setOpen(true)} className="btn-primary btn-sm"><Plus className="h-3.5 w-3.5" /> New task</button>}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const list = filtered.filter((t) => t.status === col.status);
          return (
            <div
              key={col.status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId) move(dragId, col.status);
                setDragId(null);
              }}
              className="flex min-h-[280px] flex-col rounded-xl border border-line bg-surface/60"
            >
              <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
                <span className={clsx("h-1.5 w-1.5 rounded-full", col.tone)} />
                <span className="text-[12px] font-medium">{col.label}</span>
                <span className="ml-auto rounded bg-raised px-1.5 text-[10.5px] tabular-nums text-muted">{list.length}</span>
              </div>
              <div className="flex-1 space-y-2 p-2">
                {list.map((t) => {
                  const user = users.find((u) => u.id === t.assigneeId);
                  return (
                    <div
                      key={t.id}
                      draggable={canEdit}
                      onDragStart={() => setDragId(t.id)}
                      className={clsx(
                        "group cursor-grab rounded-lg border border-line bg-panel p-2.5 shadow-card transition active:cursor-grabbing",
                        dragId === t.id && "opacity-50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={clsx("text-[12px] font-medium leading-snug", t.status === "done" && "text-muted line-through")}>{t.title}</p>
                        {canEdit && (
                          <button onClick={() => remove(t.id)} className="text-faint opacity-0 transition hover:text-rose group-hover:opacity-100" aria-label="Delete task">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-[10.5px] leading-snug text-faint">{t.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className={clsx("chip text-[9.5px]", PRIORITY_TONE[t.priority])}>{t.priority}</span>
                        <span className="chip border-line bg-raised/50 text-[9.5px] text-muted">{t.tag}</span>
                        {overdue(t) && <span className="chip border-rose/25 bg-rose/10 text-[9.5px] text-rose">overdue</span>}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line/60 pt-2">
                        <div className="flex items-center gap-1.5">
                          {user && <Avatar name={user.name} hue={user.hue} size={18} />}
                          <span className="text-[10px] text-faint">{user?.name.split(" ")[0]}</span>
                        </div>
                        <span className={clsx("flex items-center gap-1 text-[10px]", overdue(t) ? "text-rose" : "text-faint")}>
                          <CalendarDays className="h-2.5 w-2.5" /> {fmtDate(t.due, { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      {canEdit && (
                        <div className="mt-2 flex gap-1">
                          {COLUMNS.filter((c) => c.status !== t.status).slice(0, 2).map((c) => (
                            <button key={c.status} onClick={() => move(t.id, c.status)} className="flex-1 rounded-md border border-line bg-raised/40 px-1 py-0.5 text-[9.5px] text-faint transition hover:text-ink">
                              {c.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {list.length === 0 && <p className="px-2 py-6 text-center text-[11px] text-faint">Drop tasks here</p>}
              </div>
            </div>
          );
        })}
      </div>

      {open && <NewTaskModal users={users} currentUserId={currentUserId} busy={busy} onClose={() => setOpen(false)} onCreate={create} />}
    </div>
  );
}

function NewTaskModal({
  users,
  currentUserId,
  busy,
  onClose,
  onCreate,
}: {
  users: Pick<User, "id" | "name" | "hue" | "title">[];
  currentUserId: string;
  busy: boolean;
  onClose: () => void;
  onCreate: (payload: { title: string; description: string; assigneeId: string; priority: string; due: string; tag: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState(currentUserId);
  const [priority, setPriority] = useState("medium");
  const [due, setDue] = useState(new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10));
  const [tag, setTag] = useState("Technical SEO");

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onCreate({ title, description, assigneeId, priority, due, tag });
        }}
        className="w-full max-w-lg rounded-2xl border border-line bg-panel p-5 shadow-pop animate-fade-up"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-[15px] font-semibold">New task</h3>
            <p className="mt-1 text-[12px] text-muted">Assign work to your team and track it through the board.</p>
          </div>
          <button type="button" onClick={onClose} className="text-faint hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 space-y-3">
          <div><label className="label">Title</label><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="input mt-1" required /></div>
          <div><label className="label">Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="input mt-1 resize-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Assignee</label>
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="select mt-1">
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="select mt-1">
                {["low", "medium", "high"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div><label className="label">Due date</label><input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="input mt-1" /></div>
            <div>
              <label className="label">Workstream</label>
              <select value={tag} onChange={(e) => setTag(e.target.value)} className="select mt-1">
                {["Technical SEO", "Content", "Link building", "Performance", "Reporting", "General"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary btn-sm">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create task</button>
        </div>
      </form>
    </div>
  );
}
