import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { findProject } from "@/lib/derive";
import { analyzeContent } from "@/lib/analysis";
import { ContentEditor } from "@/components/content-editor";
import { CommentThread } from "@/components/comments";

export default async function ContentEditorPage({ params }: { params: Promise<{ project: string; docId: string }> }) {
  const { project: projectId, docId } = await params;
  const user = await requireUser();
  const db = getDb();
  const project = findProject(db, projectId);
  if (!project) notFound();
  const doc = db.contentDocs.find((d) => d.id === docId && d.projectId === project.id);
  if (!doc) notFound();
  const analysis = analyzeContent({ title: doc.title, keyword: doc.targetKeyword, body: doc.body });
  const comments = db.comments.filter((c) => c.entityType === "content" && c.entityId === doc.id);
  const users = db.users.map((u) => ({ id: u.id, name: u.name, hue: u.hue }));

  return (
    <div className="space-y-4">
      <ContentEditor
        doc={doc}
        projectId={project.id}
        wordpressConnected={project.wp.connected}
        initialAnalysis={analysis}
        readOnly={Boolean(user.isGuest)}
      />
      <CommentThread
        readOnly={Boolean(user.isGuest)}
        projectId={project.id}
        entityType="content"
        entityId={doc.id}
        comments={comments}
        users={users}
        currentUserId={user.id}
      />
    </div>
  );
}
