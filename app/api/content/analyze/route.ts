import { currentUser, fail, json, readJson } from "@/lib/api";
import { analyzeContent } from "@/lib/analysis";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  const body = await readJson<{ title?: string; keyword?: string; body?: string; metaTitle?: string; metaDescription?: string }>(request);
  if (!body) return fail("Invalid payload.");
  if (!body.keyword?.trim()) return fail("A focus keyword is required to score content.");
  const analysis = analyzeContent({
    title: body.title ?? "",
    keyword: body.keyword,
    body: body.body ?? "",
    metaTitle: body.metaTitle,
    metaDescription: body.metaDescription,
  });
  return json({ analysis });
}
