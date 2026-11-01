import { notFound } from "next/navigation";
import { Clock, Globe2, MapPin, Smartphone, Target } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb, roleInProject } from "@/lib/store";
import { findProject, keywordMetrics, projectKeywords, rankTrendByEngine } from "@/lib/derive";
import { ENGINES } from "@/lib/rank";
import type { Engine } from "@/lib/types";
import { fmtNumber } from "@/lib/format";
import { PageHeader, Badge } from "@/components/ui";
import { RankTracker } from "@/components/rank-tracker";
import { RefreshRanksButton } from "@/components/actions";
import { SignInToEdit } from "@/components/read-only";

export const metadata = { title: "Rank Tracker" };

export default async function RankTrackerPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: projectId } = await params;
  const user = await requireUser();
  const db = getDb();
  const project = findProject(db, projectId);
  if (!project) notFound();
  const keywords = projectKeywords(db, project.id);
  const role = roleInProject(project, user.id);
  const canEdit = role === "owner" || role === "admin" || role === "editor" || user.role === "owner";

  const trends = {} as Record<Engine, { date: string; position: number }[]>;
  for (const e of ENGINES) trends[e.key] = rankTrendByEngine(keywords, e.key, 90);

  const metrics = keywordMetrics(keywords, "google");
  const localTracked = keywords.filter((k) => k.serpFeatures.includes("Local pack")).length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><Clock className="h-3 w-3" /> Daily refreshes · 06:00 local · {fmtNumber(metrics.tracked)} keywords</>}
        title="Rank Tracker"
        description="Accurate, budget-friendly daily rank tracking across Google desktop, Google mobile, Bing and local packs — with 90-day history and hourly re-pulls on demand."
        actions={
          <>
            {user.isGuest ? <SignInToEdit what="refresh SERPs" /> : <RefreshRanksButton projectId={project.id} label="Pull latest SERPs" />}
            <div className="hidden items-center gap-2 sm:flex">
              <Badge tone="brand"><Globe2 className="h-3 w-3" /> {project.countryCode}</Badge>
              <Badge tone="sky"><Smartphone className="h-3 w-3" /> Mobile</Badge>
              <Badge tone="amber"><MapPin className="h-3 w-3" /> Local ({localTracked})</Badge>
            </div>
          </>
        }
      />
      <RankTracker projectId={project.id} keywords={keywords} trends={trends} canEdit={canEdit} />
    </div>
  );
}
