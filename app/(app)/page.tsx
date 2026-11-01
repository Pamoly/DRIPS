import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/store";

export default async function RootPage() {
  const user = await requireUser();
  const db = getDb();
  const project =
    db.projects.find((p) => p.members.some((m) => m.userId === user.id)) ?? db.projects[0];
  if (!project) redirect("/login");
  redirect(`/${project.id}`);
}
