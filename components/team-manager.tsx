"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Crown, Loader2, Mail, Plus, Shield, Trash2, UserPlus, X } from "lucide-react";
import type { Role, User } from "@/lib/types";
import { fmtRelative } from "@/lib/format";
import { Avatar, Badge, Card, SectionHeader } from "./ui";

type Member = Pick<User, "id" | "name" | "email" | "role" | "title" | "hue"> & { projectRole: Role; lastActive?: string };

const ROLE_DESC: Record<Role, string> = {
  owner: "Billing, workspace settings, all projects",
  admin: "Manage integrations, team and reports",
  editor: "Run audits, edit content and tasks",
  viewer: "Read-only dashboards and reports",
};

export function TeamManager({
  projectId,
  members,
  canManage,
  currentUserId,
}: {
  projectId: string;
  members: Member[];
  canManage: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, email, name, role }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not invite this person.");
      return;
    }
    setNotice(data.alreadyMember ? "That person is already on this project." : `Invite sent to ${email}.`);
    setOpen(false);
    setEmail("");
    setName("");
    router.refresh();
    setTimeout(() => setNotice(null), 3200);
  };

  const changeRole = async (userId: string, nextRole: Role) => {
    setPending(userId);
    await fetch(`/api/team/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, role: nextRole }),
    });
    setPending(null);
    router.refresh();
  };

  const remove = async (userId: string) => {
    if (!window.confirm("Remove this person from the project?")) return;
    setPending(userId);
    const res = await fetch(`/api/team/${userId}?projectId=${projectId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setPending(null);
    if (!res.ok) {
      setNotice(data.error ?? "Could not remove member.");
      setTimeout(() => setNotice(null), 3200);
    }
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {notice && <div className="rounded-lg border border-brand/25 bg-brand/[0.07] px-3 py-2 text-[12px] text-brand">{notice}</div>}
      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-3">
          <SectionHeader title="Project members" subtitle={`${members.length} seats · shared visibility, scoped permissions`} />
          {canManage && <button onClick={() => setOpen(true)} className="btn-primary btn-sm"><UserPlus className="h-3.5 w-3.5" /> Invite member</button>}
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-y border-line bg-raised/30">
              <th className="th">Member</th>
              <th className="th">Project role</th>
              <th className="th">Access</th>
              <th className="th">Last active</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="table-row">
                <td className="td">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={m.name} hue={m.hue} size={30} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[12.5px] font-medium">
                        {m.name}
                        {m.projectRole === "owner" && <Crown className="h-3 w-3 text-amber" />}
                        {m.id === currentUserId && <span className="text-[10px] text-faint">(you)</span>}
                      </p>
                      <p className="truncate text-[11px] text-faint">{m.email}</p>
                    </div>
                  </div>
                </td>
                <td className="td">
                  {canManage && m.projectRole !== "owner" ? (
                    <select
                      value={m.projectRole}
                      disabled={pending === m.id}
                      onChange={(e) => changeRole(m.id, e.target.value as Role)}
                      className="select !w-auto !py-1 text-[11.5px] capitalize"
                    >
                      {(["admin", "editor", "viewer"] as Role[]).map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : (
                    <Badge tone={m.projectRole === "owner" ? "amber" : "outline"} className="capitalize">{m.projectRole}</Badge>
                  )}
                </td>
                <td className="td"><span className="text-[11.5px] text-muted">{ROLE_DESC[m.projectRole]}</span></td>
                <td className="td text-[11.5px] text-muted">{fmtRelative(m.lastActive ?? null)}</td>
                <td className="td text-right">
                  {canManage && m.projectRole !== "owner" && (
                    <button onClick={() => remove(m.id)} disabled={pending === m.id} className="btn-danger btn-xs">
                      {pending === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <form onSubmit={invite} className="w-full max-w-md rounded-2xl border border-line bg-panel p-5 shadow-pop animate-fade-up">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[15px] font-semibold">Invite to project</h3>
                <p className="mt-1 text-[12px] text-muted">Add teammates or client stakeholders with scoped access.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-faint hover:text-ink"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 space-y-3">
              <div><label className="label">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input mt-1" placeholder="teammate@agency.com" required /></div>
              <div><label className="label">Name (optional)</label><input value={name} onChange={(e) => setName(e.target.value)} className="input mt-1" placeholder="Jamie Rivera" /></div>
              <div>
                <label className="label">Role</label>
                <div className="mt-1.5 space-y-1.5">
                  {(["admin", "editor", "viewer"] as Role[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={clsx("flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition", role === r ? "border-brand/40 bg-brand/[0.07]" : "border-line hover:bg-raised/40")}
                    >
                      <span className={clsx("mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border", role === r ? "border-brand bg-brand text-brand-ink" : "border-line")}>
                        {role === r && <Check className="h-2.5 w-2.5" />}
                      </span>
                      <span>
                        <span className="block text-[12px] font-medium capitalize">{r}</span>
                        <span className="block text-[10.5px] text-faint">{ROLE_DESC[r]}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="text-[12px] text-rose">{error}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">Cancel</button>
              <button type="submit" disabled={busy} className="btn-primary btn-sm">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Send invite</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function PermissionMatrix() {
  const rows = [
    { f: "View dashboards & reports", owner: true, admin: true, editor: true, viewer: true },
    { f: "Run audits & refresh ranks", owner: true, admin: true, editor: true, viewer: false },
    { f: "Edit content & tasks", owner: true, admin: true, editor: true, viewer: false },
    { f: "Send client reports", owner: true, admin: true, editor: false, viewer: false },
    { f: "Manage integrations", owner: true, admin: true, editor: false, viewer: false },
    { f: "Invite members & billing", owner: true, admin: false, editor: false, viewer: false },
  ];
  return (
    <Card padded={false}>
      <div className="p-5 pb-3"><SectionHeader title="Permissions" subtitle="What each project role can do" action={<Badge tone="outline"><Shield className="h-3 w-3" /> RBAC</Badge>} /></div>
      <table className="w-full">
        <thead>
          <tr className="border-y border-line bg-raised/30">
            <th className="th">Capability</th>
            {["Owner", "Admin", "Editor", "Viewer"].map((r) => <th key={r} className="th text-center">{r}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.f} className="table-row">
              <td className="td text-[12px]">{r.f}</td>
              {[r.owner, r.admin, r.editor, r.viewer].map((v, i) => (
                <td key={i} className="td text-center">
                  {v ? <Check className="mx-auto h-3.5 w-3.5 text-brand" /> : <span className="text-faint">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function InviteChip({ email }: { email: string }) {
  return <span className="chip border-line bg-raised/50 text-[10.5px] text-muted"><Mail className="h-2.5 w-2.5" /> {email}</span>;
}

export { Plus };
