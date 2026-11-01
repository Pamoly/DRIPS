/**
 * Real-time on-page content scoring engine.
 * Pure functions — used by the editor UI, the optimize API and the WordPress connector.
 */

export type CheckStatus = "pass" | "warn" | "fail";

export interface AnalysisCheck {
  id: string;
  label: string;
  group: "Content" | "Readability" | "Structure" | "Links" | "Meta";
  status: CheckStatus;
  weight: number;
  earned: number;
  detail: string;
}

export interface Recommendation {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  detail: string;
  points: number;
}

export interface ContentAnalysis {
  score: number;
  grade: string;
  wordCount: number;
  readingTime: number;
  keywordDensity: number;
  keywordCount: number;
  readability: number;
  readabilityLabel: string;
  headings: { h1: string[]; h2: string[]; h3: string[] };
  paragraphs: number;
  avgParagraphWords: number;
  links: { internal: number; external: number };
  images: { total: number; withAlt: number };
  checks: AnalysisCheck[];
  recommendations: Recommendation[];
  topTerms: { term: string; count: number }[];
  suggested: { title: string; description: string };
}

const STOPWORDS = new Set(
  ("a an and are as at be but by for from has have how i if in into is it its of on or our that the their them then there these they this to was we were what when where which who will with you your".split(
    " ",
  )),
);

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

function flesch(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().split(/\s+/).length > 2);
  const words = text.split(/\s+/).filter(Boolean);
  if (!sentences.length || !words.length) return 0;
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const score = 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length);
  return Math.round(Math.max(0, Math.min(100, score)));
}

function readabilityLabel(score: number): string {
  if (score >= 80) return "Very easy";
  if (score >= 65) return "Easy";
  if (score >= 55) return "Fairly easy";
  if (score >= 45) return "Standard";
  if (score >= 30) return "Difficult";
  return "Very difficult";
}

function occurrences(haystack: string, needle: string): number {
  if (!needle.trim()) return 0;
  const escaped = needle.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = haystack.toLowerCase().match(new RegExp(`\\b${escaped}\\b`, "g"));
  return matches ? matches.length : 0;
}

function titleCaseKeyword(keyword: string): string {
  const small = new Set(["and", "or", "for", "the", "a", "an", "vs", "to", "in", "of", "with"]);
  return keyword
    .split(" ")
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export function analyzeContent(input: {
  title: string;
  keyword: string;
  body: string;
  metaTitle?: string;
  metaDescription?: string;
}): ContentAnalysis {
  const title = input.title.trim();
  const keyword = input.keyword.trim();
  const body = input.body ?? "";
  const metaTitle = (input.metaTitle ?? title).trim();
  const metaDescription = (input.metaDescription ?? "").trim();

  const plain = body
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>]/g, "");
  const words = plain.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const h1 = [...body.matchAll(/^#\s+(.+)$/gm)].map((m) => m[1].trim());
  const h2 = [...body.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
  const h3 = [...body.matchAll(/^###\s+(.+)$/gm)].map((m) => m[1].trim());

  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.replace(/^#+\s*/, "").trim())
    .filter((p) => p.length > 0 && !p.startsWith("-") && !p.startsWith("|"));
  const avgParagraphWords = paragraphs.length
    ? Math.round(paragraphs.reduce((s, p) => s + p.split(/\s+/).filter(Boolean).length, 0) / paragraphs.length)
    : 0;

  const internal = [...body.matchAll(/\[[^\]]+\]\((\/[^)]*|https?:\/\/[^)]*)\)/g)].filter((m) =>
    m[1].startsWith("/") || true,
  ).length;
  const external = [...body.matchAll(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/g)].length;
  const images = body.match(/!\[([^\]]*)\]\([^)]*\)/g) ?? [];
  const imagesWithAlt = images.filter((i) => !/^!\[\s*\]/.test(i)).length;

  const keywordCount = occurrences(plain, keyword);
  const keywordDensity = wordCount ? Math.round((keywordCount / wordCount) * 10000) / 100 : 0;
  const readability = flesch(plain);
  const intro = words.slice(0, 100).join(" ");
  const keywordInIntro = occurrences(intro, keyword) > 0;
  const keywordInTitle = occurrences(title, keyword) > 0 || occurrences(metaTitle, keyword) > 0;
  const keywordInH2 = h2.filter((h) => occurrences(h, keyword) > 0).length;
  const questionHeadings = [...h2, ...h3].filter((h) => /\?|^(how|what|why|when|where|which|can|should|is|are|do|does)\b/i.test(h)).length;
  const internalLinks = Math.min(internal, 20);

  const termCounts = new Map<string, number>();
  for (const word of words) {
    const clean = word.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (clean.length < 4 || STOPWORDS.has(clean)) continue;
    termCounts.set(clean, (termCounts.get(clean) ?? 0) + 1);
  }
  const topTerms = [...termCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([term, count]) => ({ term, count }));

  const checks: AnalysisCheck[] = [];
  const push = (
    id: string,
    label: string,
    group: AnalysisCheck["group"],
    weight: number,
    status: CheckStatus,
    detail: string,
  ) => {
    const ratio = status === "pass" ? 1 : status === "warn" ? 0.5 : 0;
    checks.push({ id, label, group, weight, status, earned: Math.round(weight * ratio), detail });
  };

  const titleLen = metaTitle.length;
  push(
    "title-length",
    "Title length",
    "Meta",
    8,
    titleLen >= 30 && titleLen <= 60 ? "pass" : titleLen >= 20 && titleLen <= 70 ? "warn" : "fail",
    `${titleLen} characters — target 30–60 so the title is not truncated in Google.`,
  );

  const descLen = metaDescription.length;
  push(
    "meta-description",
    "Meta description",
    "Meta",
    8,
    descLen >= 120 && descLen <= 160 ? "pass" : descLen >= 70 ? "warn" : "fail",
    descLen ? `${descLen} characters — target 120–160 with a clear call to action.` : "No meta description yet.",
  );

  push(
    "keyword-in-title",
    "Primary keyword in title",
    "Meta",
    10,
    keywordInTitle ? "pass" : "fail",
    keywordInTitle ? `"${keyword}" appears in the title tag.` : `Add "${keyword}" to the title, ideally within the first 50 characters.`,
  );

  push(
    "keyword-in-intro",
    "Keyword in first 100 words",
    "Content",
    8,
    keywordInIntro ? "pass" : "fail",
    keywordInIntro ? "Search intent is clear above the fold." : `Mention "${keyword}" in the opening paragraph.`,
  );

  push(
    "keyword-in-h2",
    "Keyword in subheadings",
    "Structure",
    8,
    keywordInH2 >= 2 ? "pass" : keywordInH2 === 1 ? "warn" : "fail",
    `${keywordInH2} of ${h2.length} H2 headings include the keyword. Aim for at least 2.`,
  );

  push(
    "keyword-density",
    "Keyword density",
    "Content",
    8,
    keywordDensity >= 0.4 && keywordDensity <= 2.6 ? "pass" : keywordDensity > 0 && keywordDensity <= 3.6 ? "warn" : "fail",
    `${keywordDensity}% density (${keywordCount} mentions). Healthy range is 0.4%–2.6%.`,
  );

  push(
    "word-count",
    "Content depth",
    "Content",
    10,
    wordCount >= 800 ? "pass" : wordCount >= 450 ? "warn" : "fail",
    `${wordCount} words. Top-ranking pages for this topic average 1,200+ words.`,
  );

  push(
    "heading-structure",
    "Heading structure",
    "Structure",
    8,
    h1.length === 1 && h2.length >= 3 ? "pass" : h1.length <= 1 && h2.length >= 1 ? "warn" : "fail",
    `${h1.length} H1, ${h2.length} H2, ${h3.length} H3. Use exactly one H1 and 3+ H2 sections.`,
  );

  push(
    "readability",
    "Readability",
    "Readability",
    8,
    readability >= 60 ? "pass" : readability >= 45 ? "warn" : "fail",
    `Flesch reading ease ${readability} (${readabilityLabel(readability)}). Aim above 55 for web content.`,
  );

  push(
    "paragraph-length",
    "Paragraph length",
    "Readability",
    5,
    avgParagraphWords <= 70 ? "pass" : avgParagraphWords <= 100 ? "warn" : "fail",
    `Average ${avgParagraphWords} words per paragraph. Keep blocks under 70 words for mobile readers.`,
  );

  push(
    "internal-links",
    "Internal links",
    "Links",
    6,
    internalLinks >= 2 ? "pass" : internalLinks === 1 ? "warn" : "fail",
    `${internalLinks} internal link${internalLinks === 1 ? "" : "s"} detected. Link to 2–4 related pages.`,
  );

  push(
    "external-links",
    "External citations",
    "Links",
    4,
    external >= 1 ? "pass" : "warn",
    `${external} external citation${external === 1 ? "" : "s"}. Reference one authoritative source.`,
  );

  push(
    "image-alt",
    "Image alt text",
    "Links",
    4,
    images.length === 0 ? "warn" : imagesWithAlt === images.length ? "pass" : "fail",
    images.length === 0
      ? "No images found — add at least one with descriptive alt text."
      : `${imagesWithAlt}/${images.length} images have alt text.`,
  );

  push(
    "faq",
    "Question headings",
    "Structure",
    5,
    questionHeadings >= 1 ? "pass" : "warn",
    `${questionHeadings} question-style heading${questionHeadings === 1 ? "" : "s"}. Questions win People Also Ask and AI Overviews.`,
  );

  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce((s, c) => s + c.earned, 0);
  const score = Math.round((earned / totalWeight) * 100);

  const recommendations: Recommendation[] = checks
    .filter((c) => c.status !== "pass")
    .sort((a, b) => b.weight - a.weight)
    .map((c) => ({
      id: c.id,
      priority: c.weight >= 9 ? "high" : c.weight >= 7 ? "medium" : "low",
      title: c.label,
      detail: c.detail,
      points: c.weight - c.earned,
    }));

  const suggestedTitle = (() => {
    const base = title.toLowerCase().includes(keyword.toLowerCase()) ? title : `${titleCaseKeyword(keyword)}: ${title}`;
    return base.length > 60 ? `${base.slice(0, 57).trim()}...` : base;
  })();

  const suggestedDescription = (() => {
    const lead = `Looking for ${keyword}?`;
    const bodyText = plain.slice(0, 120).replace(/\s+/g, " ").trim();
    const combined = `${lead} ${bodyText}`.replace(/\s+/g, " ");
    return combined.length > 158 ? `${combined.slice(0, 155).trim()}...` : combined;
  })();

  return {
    score,
    grade: score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 55 ? "Needs work" : "Poor",
    wordCount,
    readingTime: Math.max(1, Math.round(wordCount / 220)),
    keywordDensity,
    keywordCount,
    readability,
    readabilityLabel: readabilityLabel(readability),
    headings: { h1, h2, h3 },
    paragraphs: paragraphs.length,
    avgParagraphWords,
    links: { internal: internalLinks, external },
    images: { total: images.length, withAlt: imagesWithAlt },
    checks,
    recommendations,
    topTerms,
    suggested: { title: suggestedTitle, description: suggestedDescription },
  };
}
