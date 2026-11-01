import { currentUser, fail, json, readJson } from "@/lib/api";
import { getDb } from "@/lib/store";
import { analyzeContent } from "@/lib/analysis";

const ANGLES = [
  "What to look for before you buy",
  "How we tested and scored the options",
  "Budget vs premium: what changes",
  "Common mistakes and how to avoid them",
  "Sizing, fit and compatibility",
  "Maintenance and long-term durability",
];

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  const body = await readJson<{ projectId?: string; keyword?: string; title?: string }>(request);
  if (!body?.keyword?.trim()) return fail("A focus keyword is required.");
  const db = getDb();
  const project = body.projectId ? db.projects.find((p) => p.id === body.projectId) : undefined;
  const keyword = body.keyword.trim();
  const title = body.title?.trim() || keyword.charAt(0).toUpperCase() + keyword.slice(1);

  // Topical terms extracted from the project's existing keyword clusters.
  const related = new Set<string>();
  if (project) {
    for (const k of db.keywords.filter((x) => x.projectId === project.id)) {
      for (const word of k.phrase.toLowerCase().split(/\s+/)) {
        if (word.length > 4 && !keyword.toLowerCase().includes(word)) related.add(word);
      }
      if (related.size > 40) break;
    }
  }
  const relatedTerms = [...related].slice(0, 8);

  const outline = [
    `# ${title}`,
    "",
    `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} matter to buyers and researchers alike. This guide covers what to compare, how to choose, and which options earn their place.`,
    "",
    "## Key takeaways",
    "",
    `- What separates good ${keyword} from average ones`,
    "- The three specs that actually change performance",
    "- Recommended picks by budget and use case",
    "",
    ...ANGLES.slice(0, 4).flatMap((angle) => [`## ${angle}`, "", `_Write 120–180 words covering ${angle.toLowerCase()} for ${keyword}._`, ""]),
    "## Frequently asked questions",
    "",
    `### What is the best ${keyword} for beginners?`,
    "",
    "Answer in 40–60 words with a concrete recommendation.",
    "",
    `### How much should I spend on ${keyword}?`,
    "",
    "Give a price band and what the extra spend unlocks.",
    "",
    "## Sources",
    "",
    "- [Authoritative source](https://example.com)",
  ].join("\n");

  const analysis = analyzeContent({ title, keyword, body: outline });
  return json({
    outline,
    relatedTerms,
    suggested: analysis.suggested,
    projectedScore: analysis.score,
    checks: analysis.recommendations.length,
  });
}
