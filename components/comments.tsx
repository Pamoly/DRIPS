"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, MessageSquare, Send } from "lucide-react";
import type { Comment, User } from "@/lib/types";
import { fmtRelative } from "@/lib/format";
import { Avatar, Card, SectionHeader } from "./ui";

export function CommentThread({
  projectId,
  entityType,
  entityId,
  comments,
  users,
  currentUserId,
  readOnly = false,
}: {
  projectId: string;
  entityType: "audit" | "page" | "report" | "content";
  entityId: string;
  comments: Comment[];
  users: Pick<User, "id" | "name" | "hue">[];
  currentUserId: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, entityType, entityId, text }),
    });
    setText("");
    setBusy(false);
    router.refresh();
  };

  return (
    <Card>
      <SectionHeader
        title={<span className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5" /> Team notes</span>}
        subtitle={`${comments.length} comment${comments.length === 1 ? "" : "s"} on this ${entityType}`}
      />
      <ul className="mt-4 space-y-3">
        {comments.map((c) => {
          const author = users.find((u) => u.id === c.userId);
          return (
            <li key={c.id} className="flex gap-2.5">
              <Avatar name={author?.name ?? "?"} hue={author?.hue ?? 152} size={24} />
              <div className="min-w-0 flex-1 rounded-lg border border-line bg-raised/25 px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] font-medium">{author?.name ?? "Teammate"}</span>
                  <span className="text-[10.5px] text-faint">{fmtRelative(c.at)}</span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">{c.text}</p>
              </div>
            </li>
          );
        })}
        {comments.length === 0 && <li className="text-[12px] text-faint">No comments yet — start the conversation.</li>}
      </ul>
      {readOnly ? (
        <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-3 text-[11.5px] text-faint">
          <Lock className="h-3 w-3" /> Guest view — sign in to join the conversation.
        </p>
      ) : (
      <form onSubmit={submit} className="mt-3 flex items-start gap-2 border-t border-line pt-3">
        <Avatar name={users.find((u) => u.id === currentUserId)?.name ?? "You"} hue={users.find((u) => u.id === currentUserId)?.hue ?? 152} size={24} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Leave a note for your team or client…"
          className="input flex-1 !py-2 text-[12px]"
        />
        <button type="submit" disabled={busy || !text.trim()} className="btn-primary btn-sm !px-2.5">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </button>
      </form>
      )}
    </Card>
  );
}
