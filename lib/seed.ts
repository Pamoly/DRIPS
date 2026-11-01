import type {
  Activity, AiPrompt, Audit, AuditIssue, AuditPage, Backlink, Comment, Competitor, ContentDoc,
  Database, GscQuery, Intent, Keyword, Project, Report, Role, Task, User, Widget,
} from "./types";
import { clamp, dayKey, hashString, isoDaysAgo, pick, randInt, range, rngFor, round, slugify } from "./rand";

/* ----------------------------------------------------------------------------
 * Account + workspace blueprints
 * -------------------------------------------------------------------------- */

const USERS: User[] = [
  { id: "u_avery", name: "Avery Chen", email: "avery@drips.app", role: "owner", title: "Head of Growth", hue: 152 },
  { id: "u_priya", name: "Priya Patel", email: "priya@drips.app", role: "admin", title: "SEO Strategist", hue: 262 },
  { id: "u_marcus", name: "Marcus Reed", email: "marcus@drips.app", role: "editor", title: "Content Lead", hue: 205 },
  { id: "u_sofia", name: "Sofia Ruiz", email: "sofia@drips.app", role: "editor", title: "Technical SEO", hue: 35 },
  { id: "u_jonas", name: "Jonas Weber", email: "jonas@client.com", role: "viewer", title: "Client · Northwind", hue: 320 },
];

type Blueprint = {
  id: string;
  name: string;
  domain: string;
  color: string;
  country: string;
  countryCode: string;
  language: string;
  seats: Role[];
  comps: { domain: string; name: string; dr: number }[];
  seeds: { term: string; cluster: string }[];
  modifiers: ((s: string, alt: string) => string)[];
  paths: string[];
  titleStyle: (phrase: string) => string;
};

const BLUEPRINTS: Blueprint[] = [
  {
    id: "northwind",
    name: "Northwind Outdoors",
    domain: "northwindoutdoors.com",
    color: "#4ADE80",
    country: "United States",
    countryCode: "US",
    language: "English",
    seats: ["owner", "admin", "editor", "viewer"],
    comps: [
      { domain: "backcountry.com", name: "Backcountry", dr: 91 },
      { domain: "rei.com", name: "REI Co-op", dr: 93 },
      { domain: "outdoorgearlab.com", name: "OutdoorGearLab", dr: 82 },
      { domain: "gearjunkie.com", name: "GearJunkie", dr: 78 },
      { domain: "moosejaw.com", name: "Moosejaw", dr: 80 },
    ],
    seeds: [
      { term: "hiking boots", cluster: "Hiking footwear" },
      { term: "trail running shoes", cluster: "Hiking footwear" },
      { term: "waterproof jacket", cluster: "Outerwear" },
      { term: "rain shell", cluster: "Outerwear" },
      { term: "puffer vest", cluster: "Outerwear" },
      { term: "camping tent", cluster: "Camping shelters" },
      { term: "hammock", cluster: "Camping shelters" },
      { term: "down sleeping bag", cluster: "Sleep systems" },
      { term: "camp pillow", cluster: "Sleep systems" },
      { term: "backpacking backpack", cluster: "Packs" },
      { term: "hydration bladder", cluster: "Packs" },
      { term: "trekking poles", cluster: "Trail accessories" },
      { term: "hiking socks", cluster: "Trail accessories" },
      { term: "headlamp", cluster: "Trail accessories" },
      { term: "insulated water bottle", cluster: "Drinkware" },
      { term: "camp stove", cluster: "Camp kitchen" },
      { term: "camp chair", cluster: "Camp kitchen" },
      { term: "bear canister", cluster: "Camp kitchen" },
      { term: "hiking pants", cluster: "Apparel" },
      { term: "base layer", cluster: "Apparel" },
    ],
    modifiers: [
      (s) => s,
      (s) => `best ${s}`,
      (s) => `${s} review`,
      (s) => `cheap ${s}`,
      (s) => `${s} for women`,
      (s) => `${s} for men`,
      (s) => `lightweight ${s}`,
      (s) => `waterproof ${s}`,
      (s) => `${s} near me`,
      (s) => `${s} sale`,
      (s) => `${s} under 100`,
      (s, alt) => `${s} vs ${alt}`,
      (s) => `how to choose ${s}`,
      (s) => `${s} size guide`,
    ],
    paths: ["/collections/hiking-boots", "/products/trail-shell-jacket", "/guides/best-hiking-boots", "/collections/camping", "/blog/trail-running-gear-guide", "/products/alpine-40l-pack"],
    titleStyle: (p) => `${p.replace(/\b\w/g, (c) => c.toUpperCase())} | Northwind Outdoors`,
  },
  {
    id: "lumen",
    name: "Lumen Analytics",
    domain: "lumenanalytics.io",
    color: "#818CF8",
    country: "United Kingdom",
    countryCode: "GB",
    language: "English",
    seats: ["owner", "admin", "editor"],
    comps: [
      { domain: "mixpanel.com", name: "Mixpanel", dr: 90 },
      { domain: "amplitude.com", name: "Amplitude", dr: 89 },
      { domain: "heap.io", name: "Heap", dr: 83 },
      { domain: "posthog.com", name: "PostHog", dr: 82 },
      { domain: "segment.com", name: "Segment", dr: 88 },
    ],
    seeds: [
      { term: "product analytics", cluster: "Analytics platform" },
      { term: "customer analytics", cluster: "Analytics platform" },
      { term: "funnel analysis", cluster: "Analysis workflows" },
      { term: "cohort analysis", cluster: "Analysis workflows" },
      { term: "retention analysis", cluster: "Analysis workflows" },
      { term: "user behavior analytics", cluster: "Analysis workflows" },
      { term: "session replay", cluster: "Digital experience" },
      { term: "heatmap tool", cluster: "Digital experience" },
      { term: "ab testing software", cluster: "Experimentation" },
      { term: "feature flags", cluster: "Experimentation" },
      { term: "marketing attribution", cluster: "Attribution" },
      { term: "first party data", cluster: "Attribution" },
      { term: "reverse etl", cluster: "Data infrastructure" },
      { term: "data warehouse", cluster: "Data infrastructure" },
      { term: "cdp", cluster: "Data infrastructure" },
      { term: "event tracking", cluster: "Implementation" },
      { term: "tracking plan", cluster: "Implementation" },
      { term: "embedded analytics", cluster: "Embedded BI" },
      { term: "kpi dashboard", cluster: "Embedded BI" },
      { term: "product led growth", cluster: "Growth strategy" },
    ],
    modifiers: [
      (s) => s,
      (s) => `best ${s}`,
      (s) => `${s} tools`,
      (s) => `${s} software`,
      (s) => `${s} for startups`,
      (s) => `free ${s}`,
      (s) => `${s} pricing`,
      (s) => `${s} alternatives`,
      (s) => `${s} template`,
      (s) => `what is ${s}`,
      (s) => `${s} metrics`,
      (s, alt) => `${s} vs ${alt}`,
      (s) => `how to implement ${s}`,
      (s) => `${s} for saas`,
    ],
    paths: ["/product/analytics", "/pricing", "/blog/funnel-analysis-guide", "/features/cohorts", "/compare/mixpanel", "/guides/tracking-plan"],
    titleStyle: (p) => `${p.replace(/\b\w/g, (c) => c.toUpperCase())} · Lumen Analytics`,
  },
  {
    id: "verdant",
    name: "Verdant Home",
    domain: "verdanthome.co",
    color: "#FBBF24",
    country: "Canada",
    countryCode: "CA",
    language: "English",
    seats: ["owner", "editor", "viewer"],
    comps: [
      { domain: "thespruce.com", name: "The Spruce", dr: 90 },
      { domain: "gardenerspath.com", name: "Gardener's Path", dr: 76 },
      { domain: "epicgardening.com", name: "Epic Gardening", dr: 79 },
      { domain: "hortzone.com", name: "Hort Zone", dr: 61 },
      { domain: "gardenersworld.com", name: "Gardeners' World", dr: 85 },
    ],
    seeds: [
      { term: "indoor plants", cluster: "Houseplants" },
      { term: "monstera care", cluster: "Houseplants" },
      { term: "houseplant fertilizer", cluster: "Houseplants" },
      { term: "raised garden bed", cluster: "Garden build" },
      { term: "compost bin", cluster: "Garden build" },
      { term: "drip irrigation", cluster: "Garden build" },
      { term: "vegetable garden", cluster: "Growing food" },
      { term: "herb garden", cluster: "Growing food" },
      { term: "seed starting", cluster: "Growing food" },
      { term: "soil test", cluster: "Soil & care" },
      { term: "mulch", cluster: "Soil & care" },
      { term: "lawn care", cluster: "Soil & care" },
      { term: "grow lights", cluster: "Gear" },
      { term: "pruning shears", cluster: "Gear" },
      { term: "garden hose reel", cluster: "Gear" },
      { term: "patio furniture", cluster: "Outdoor living" },
      { term: "plant stand", cluster: "Outdoor living" },
      { term: "bird feeder", cluster: "Outdoor living" },
      { term: "pollinator garden", cluster: "Native gardening" },
      { term: "native plants", cluster: "Native gardening" },
    ],
    modifiers: [
      (s) => s,
      (s) => `best ${s}`,
      (s) => `${s} ideas`,
      (s) => `how to ${s}`,
      (s) => `${s} for beginners`,
      (s) => `${s} care`,
      (s) => `${s} diy`,
      (s) => `cheap ${s}`,
      (s) => `${s} near me`,
      (s) => `${s} guide`,
      (s) => `${s} in small spaces`,
      (s, alt) => `${s} vs ${alt}`,
      (s) => `when to ${s}`,
      (s) => `${s} mistakes`,
    ],
    paths: ["/plants/monstera-deliciosa", "/garden/raised-beds", "/blog/composting-101", "/collections/patio", "/blog/native-plants", "/products/grow-light-2"],
    titleStyle: (p) => `${p.replace(/\b\w/g, (c) => c.toUpperCase())} — Verdant Home`,
  },
];

/* ----------------------------------------------------------------------------
 * Audit issue catalog
 * -------------------------------------------------------------------------- */

type IssueSeed = Omit<AuditIssue, "id" | "affected" | "crawled">;

const ISSUE_CATALOG: IssueSeed[] = [
  { title: "Pages missing meta description", category: "On-page", severity: "warning", impact: "Medium", detail: "Search engines generate snippets automatically, which reduces click-through control and can surface unrelated page copy.", fix: "Write unique 140–160 character descriptions that include the target keyword and a clear value proposition." },
  { title: "Title tag exceeds 60 characters", category: "On-page", severity: "notice", impact: "Low", detail: "Titles longer than 60 characters are truncated in desktop SERPs.", fix: "Shorten titles and front-load the primary keyword within the first 50 characters." },
  { title: "Images missing alt attributes", category: "On-page", severity: "warning", impact: "Medium", detail: "Decorative and content images without alt text hurt accessibility and image search visibility.", fix: "Add concise descriptive alt text to content images and empty alt attributes to decorative images." },
  { title: "Multiple H1 elements on page", category: "On-page", severity: "notice", impact: "Low", detail: "Multiple H1s dilute topical signals and make heading structure harder for crawlers to parse.", fix: "Keep one H1 per page and demote secondary headings to H2 or H3." },
  { title: "Thin content below 300 words", category: "Content", severity: "warning", impact: "Medium", detail: "Short pages rarely satisfy search intent and compete poorly for informational queries.", fix: "Expand with original examples, FAQs, and comparison tables, or consolidate into a stronger page." },
  { title: "Duplicate title tags across pages", category: "Content", severity: "warning", impact: "Medium", detail: "Duplicate titles cause competing pages to target the same query and split ranking signals.", fix: "Differentiate titles by intent, or canonicalise the weaker duplicate to the primary page." },
  { title: "Missing canonical tag", category: "Technical", severity: "warning", impact: "Medium", detail: "Without a canonical, parameterised and duplicate URLs can be indexed separately.", fix: "Add a self-referencing canonical on every indexable page and point variants to the primary URL." },
  { title: "Pages blocked by robots.txt", category: "Technical", severity: "critical", impact: "High", detail: "Blocked resources prevent crawlers from seeing critical content and rendering instructions.", fix: "Remove content directories from the disallow list and validate with the robots.txt tester." },
  { title: "Broken internal links (4xx)", category: "Links", severity: "critical", impact: "High", detail: "Internal links returning 404 waste crawl budget and break user journeys.", fix: "Update or 301-redirect broken destinations and re-crawl the affected templates." },
  { title: "Redirect chains longer than 2 hops", category: "Technical", severity: "warning", impact: "Medium", detail: "Long redirect chains slow crawling and reduce link equity passed to the destination.", fix: "Point redirects directly to the final URL and update CMS link fields." },
  { title: "Missing structured data", category: "Technical", severity: "notice", impact: "Low", detail: "Pages lack Product, Article, or FAQ schema that enables rich results.", fix: "Add JSON-LD schema matching the page type and validate in the Rich Results Test." },
  { title: "Slow Largest Contentful Paint (>2.5s)", category: "Performance", severity: "critical", impact: "High", detail: "LCP above 2.5s fails Core Web Vitals, affecting both rankings and conversion rate.", fix: "Preload the hero image, serve responsive AVIF/WebP, and remove render-blocking scripts." },
  { title: "High cumulative layout shift", category: "Performance", severity: "warning", impact: "Medium", detail: "Elements shifting after paint create a poor experience and fail the CLS threshold of 0.1.", fix: "Reserve space for embeds and images, and preload fonts to avoid late swaps." },
  { title: "Uncompressed image assets", category: "Performance", severity: "warning", impact: "Medium", detail: "Oversized images dominate page weight and delay rendering on mobile connections.", fix: "Convert to next-gen formats and serve correctly sized responsive variants." },
  { title: "Render-blocking third-party scripts", category: "Performance", severity: "warning", impact: "Medium", detail: "Synchronous tags delay the first paint by more than 600ms on median mobile.", fix: "Defer or lazily load non-critical tags and audit the tag manager container." },
  { title: "Missing HSTS header", category: "Security", severity: "notice", impact: "Low", detail: "Without HSTS, first visits can be downgraded to insecure HTTP.", fix: "Add Strict-Transport-Security with a one-year max-age after confirming HTTPS coverage." },
  { title: "Mixed content on secure pages", category: "Security", severity: "warning", impact: "Medium", detail: "HTTP assets on HTTPS pages trigger browser warnings and can be blocked entirely.", fix: "Update asset URLs to HTTPS and audit hardcoded legacy references." },
  { title: "Orphan pages with no internal links", category: "Links", severity: "warning", impact: "Medium", detail: "Pages without internal links receive little crawl attention and rarely rank.", fix: "Link from relevant category hubs and add them to XML sitemaps." },
  { title: "XML sitemap includes non-indexable URLs", category: "Technical", severity: "notice", impact: "Low", detail: "Noindexed and redirected URLs in sitemaps slow crawl evaluation.", fix: "Filter sitemap generation to canonical, indexable, 200-status URLs only." },
  { title: "Missing Open Graph metadata", category: "On-page", severity: "notice", impact: "Low", detail: "Shared links render without imagery or description on social platforms.", fix: "Add og:title, og:description, and a 1200×630 og:image to main templates." },
  { title: "Keyword cannibalisation detected", category: "Content", severity: "warning", impact: "Medium", detail: "Three or more URLs rank for the same query, splitting relevance and clicks.", fix: "Consolidate overlapping pages or reposition one as a distinct sub-intent." },
  { title: "Large HTML payload (>150KB)", category: "Performance", severity: "notice", impact: "Low", detail: "Excessive inline markup slows parsing, especially on low-end mobile devices.", fix: "Trim inline scripts, paginate long listings, and move data to API endpoints." },
];

const SEVERITY_WEIGHT = { critical: 12, warning: 6, notice: 2 } as const;

/* ----------------------------------------------------------------------------
 * Builders
 * -------------------------------------------------------------------------- */

function generateKeywords(bp: Blueprint): Keyword[] {
  const rng = rngFor("kw", bp.id);
  const seen = new Set<string>();
  const out: Keyword[] = [];
  let seedIndex = 0;
  let modIndex = 0;
  const target = bp.id === "northwind" ? 92 : bp.id === "lumen" ? 86 : 78;

  while (out.length < target && seedIndex < bp.seeds.length * 12) {
    const seed = bp.seeds[seedIndex % bp.seeds.length];
    const mod = bp.modifiers[modIndex % bp.modifiers.length];
    seedIndex++;
    if (modIndex % bp.seeds.length === bp.seeds.length - 1) modIndex++;
    else modIndex++;

    const altSeed = bp.seeds[(seedIndex * 3 + 5) % bp.seeds.length].term;
    const phrase = mod(seed.term, altSeed).replace(/\s+/g, " ").trim();
    if (seen.has(phrase)) continue;
    seen.add(phrase);

    const isHead = phrase === seed.term;
    const isComparison = phrase.includes(" vs ");
    const isLong = phrase.split(" ").length >= 5;

    let volume: number;
    if (isHead) volume = randInt(rng, 40, 140) * 1000 + randInt(rng, 0, 999) * 10;
    else if (isComparison) volume = randInt(rng, 2, 18) * 100;
    else if (isLong) volume = randInt(rng, 3, 25) * 100;
    else volume = randInt(rng, 1, 45) * 100;

    const difficulty = clamp(
      Math.round(12 + Math.log10(volume + 10) * 13 + (isHead ? 14 : 0) + rng() * 16 - (isLong ? 6 : 0)),
      3,
      93,
    );
    const cpc = round(0.18 + (difficulty / 100) * 6.4 + rng() * 1.9, 2);

    const intent: Intent = isComparison
      ? "commercial"
      : /how|what|guide|when|mistake|care|choose|ideas/.test(phrase)
        ? "informational"
        : /near me|sale|pricing|buy|under|cheap|for (women|men|startups|beginners)/.test(phrase)
          ? "transactional"
          : /review|best|vs|alternatives|tools|software|size guide/.test(phrase)
            ? "commercial"
            : "informational";

    const roll = rng();
    let position: number | null;
    if (roll < 0.1) position = null;
    else if (roll < 0.44) position = randInt(rng, 1, 10);
    else if (roll < 0.72) position = randInt(rng, 11, 30);
    else if (roll < 0.92) position = randInt(rng, 31, 60);
    else position = randInt(rng, 61, 98);

    const drift = randInt(rng, -7, 7);
    const prevPosition = position === null ? randInt(rng, 85, 120) : clamp(position + drift, 1, 100);
    const bestPosition = position === null ? randInt(rng, 60, 99) : Math.max(1, Math.min(position, prevPosition) - randInt(rng, 0, 6));

    const path = bp.paths[randInt(rng, 0, bp.paths.length - 1)];
    const url = position !== null && position <= 40 ? `https://${bp.domain}${path}` : null;
    const impressions = position !== null && position <= 50 ? Math.round(volume * (0.12 + rng() * 0.31)) : 0;
    const ctrByPos = [0.28, 0.16, 0.11, 0.08, 0.06, 0.045, 0.035, 0.028, 0.024, 0.02][Math.min((position ?? 30) - 1, 9)] ?? 0.008;

    const serpFeatures: string[] = [];
    if (rng() > 0.55) serpFeatures.push("Featured snippet");
    if (/best|review|vs|alternatives/.test(phrase) && rng() > 0.4) serpFeatures.push("AI Overview");
    if (intent === "transactional" && rng() > 0.5) serpFeatures.push("Shopping");
    if (rng() > 0.72) serpFeatures.push("People also ask");
    if (/near me|local/.test(phrase) && rng() > 0.45) serpFeatures.push("Local pack");

    out.push({
      id: `kw_${bp.id}_${out.length + 1}`,
      projectId: bp.id,
      phrase,
      volume,
      cpc,
      difficulty,
      intent,
      cluster: seed.cluster,
      position,
      prevPosition,
      bestPosition,
      url,
      country: bp.country,
      countryCode: bp.countryCode,
      serpFeatures,
      tracked: rng() > 0.14,
      tags: [isHead ? "head" : isLong ? "long-tail" : "mid-tail", intent],
      createdAt: isoDaysAgo(randInt(rng, 20, 400)),
      gscClicks: Math.round(impressions * ctrByPos),
      gscImpressions: impressions,
    });
  }
  return out;
}

function generateAudit(bp: Blueprint, index: number, projectId: string, createdById: string): Audit {
  const rng = rngFor("audit", bp.id, index);
  const createdAt = isoDaysAgo(3 + index * 17 + randInt(rng, 0, 3), 7 + index);
  const issueSample = [...ISSUE_CATALOG].sort(() => rng() - 0.5).slice(0, 15 + randInt(rng, 0, 4));

  const issues: AuditIssue[] = issueSample.map((base, i) => ({
    ...base,
    id: `iss_${bp.id}_${index}_${i}`,
    affected: base.category === "Technical" ? randInt(rng, 2, 38) : randInt(rng, 1, 24),
    crawled: createdAt,
  }));

  const pageCount = randInt(rng, 38, 72);
  const pages: AuditPage[] = range(pageCount).map((i) => {
    const basePath = bp.paths[i % bp.paths.length];
    const suffix = i > bp.paths.length - 1 ? `-${Math.floor(i / bp.paths.length) + 1}` : "";
    const url = `https://${bp.domain}${basePath}${suffix}`;
    const pageIssues = [...issues].sort(() => rng() - 0.5).slice(0, randInt(rng, 1, 6));
    const penalty = pageIssues.reduce((sum, issue) => sum + SEVERITY_WEIGHT[issue.severity], 0);
    return {
      url,
      title: `${bp.titleStyle(bp.seeds[i % bp.seeds.length].term)}${suffix}`,
      score: clamp(100 - penalty - randInt(rng, 0, 9), 31, 99),
      statusCode: i === 7 && index === 0 ? 404 : rng() > 0.96 ? 301 : 200,
      responseMs: randInt(rng, 90, 1250),
      words: randInt(rng, 180, 2800),
      issues: pageIssues.map((p) => p.title),
      lcp: round(1.1 + rng() * 3.6, 2),
      cls: round(rng() * 0.38, 2),
      inp: randInt(rng, 90, 520),
    };
  });

  const avgScore = Math.round(pages.reduce((s, p) => s + p.score, 0) / pages.length);
  const score = clamp(avgScore - (index === 0 ? 0 : 3), 35, 96);

  return {
    id: `audit_${bp.id}_${index + 1}`,
    projectId,
    name: index === 0 ? "Full site crawl" : "Template spot check",
    startUrl: `https://${bp.domain}`,
    createdAt,
    completedAt: createdAt,
    status: "completed",
    score,
    pagesCrawled: pageCount,
    issues,
    pages,
    vitals: {
      lcp: round(1.4 + rng() * 2.6, 2),
      cls: round(rng() * 0.26, 2),
      inp: randInt(rng, 110, 430),
      fcp: round(0.8 + rng() * 1.6, 2),
      ttfb: randInt(rng, 80, 620),
    },
    createdBy: createdById,
    schedule: index === 0 ? "weekly" : "monthly",
  };
}

function generateCompetitors(bp: Blueprint): Competitor[] {
  const rng = rngFor("comp", bp.id);
  return bp.comps.map((c, i) => {
    const dr = c.dr + randInt(rng, -3, 3);
    const visibility = round(clamp(62 - i * 8 + rng() * 14, 8, 78), 1);
    const kws = randInt(rng, 18, 92) * 1000;
    const gapKeywords = range(9).map((g) => {
      const seed = bp.seeds[(i + g * 3) % bp.seeds.length];
      const mod = bp.modifiers[(g + 2) % bp.modifiers.length];
      const phrase = mod(seed.term, bp.seeds[(g + 7) % bp.seeds.length].term);
      const volume = randInt(rng, 2, 55) * 100;
      return {
        phrase,
        volume,
        difficulty: randInt(rng, 12, 82),
        theirPosition: randInt(rng, 1, 22),
        gapScore: randInt(rng, 38, 97),
        intent: pick(rng, ["commercial", "informational", "transactional", "navigational"] as Intent[]),
      };
    });
    return {
      id: `comp_${bp.id}_${i + 1}`,
      projectId: bp.id,
      domain: c.domain,
      name: c.name,
      dr,
      traffic: randInt(rng, 120, 4800) * 1000,
      keywords: kws,
      visibility,
      backlinks: randInt(rng, 40, 980) * 1000,
      referringDomains: randInt(rng, 800, 42000),
      trend: range(14).map((d) => round(clamp(visibility + (rng() - 0.48) * 9 + Math.sin(d / 2.4) * 2.2, 2, 90), 1)),
      gapKeywords,
      gained: randInt(rng, 40, 640),
      lost: randInt(rng, 20, 380),
    };
  });
}

function generateBacklinks(bp: Blueprint): Backlink[] {
  const rng = rngFor("links", bp.id);
  const publishers = ["gearadvisor", "theouteredge", "trailnotes", "fieldreview", "welldesigned", "themodernoutdoors", "productweekly", "reviewedlab", "growthstack", "saasdigest", "thestrategist", "betterliving", "homestylemag", "gardendesk", "plantparent", "urbangarden"];
  const anchors = ["northwind outdoors", "best hiking boots", "trail shell jacket", "read more", "shop now", "expert gear reviews", "view the guide", "source", "northwind", "lightweight backpacking gear"];
  return range(64).map((i) => {
    const publisher = pick(rng, publishers);
    const tld = pick(rng, [".com", ".co.uk", ".ca", ".net", ".io"]);
    const sourceDomain = `${publisher}${tld}`;
    const dr = randInt(rng, 22, 90);
    const type = rng() > 0.24 ? "dofollow" : rng() > 0.6 ? "nofollow" : "ugc";
    const firstSeen = isoDaysAgo(randInt(rng, 1, 340));
    const status: Backlink["status"] = i < 6 ? "new" : rng() > 0.93 ? "lost" : "live";
    return {
      id: `bl_${bp.id}_${i + 1}`,
      projectId: bp.id,
      sourceUrl: `https://${sourceDomain}/${pick(rng, ["reviews", "blog", "guides", "features", "best"])}/${slugify(pick(rng, bp.seeds).term)}-${randInt(rng, 100, 999)}`,
      sourceDomain,
      targetUrl: `https://${bp.domain}${bp.paths[i % bp.paths.length]}`,
      anchor: rng() > 0.5 ? pick(rng, anchors) : pick(rng, bp.seeds).term,
      dr,
      type: type as Backlink["type"],
      firstSeen,
      lastSeen: isoDaysAgo(status === "lost" ? randInt(rng, 1, 8) : 0),
      status,
      traffic: randInt(rng, 40, 24000),
    };
  });
}

function generateGsc(bp: Blueprint, kws: Keyword[]): GscQuery[] {
  const rng = rngFor("gsc", bp.id);
  const source = kws.filter((k) => k.position !== null).slice(0, 52);
  return source.map((k, i) => {
    const impressions = Math.round(k.volume * (0.9 + rng() * 1.7));
    const pos = k.position ?? 40;
    const ctrCurve = [0.28, 0.16, 0.11, 0.075, 0.055, 0.042, 0.032, 0.026, 0.022, 0.019];
    const baseCtr = pos <= 10 ? ctrCurve[pos - 1] : pos <= 20 ? 0.012 : 0.004;
    const ctr = round(clamp(baseCtr * (0.75 + rng() * 0.6), 0.002, 0.32), 4);
    return {
      id: `gq_${bp.id}_${i + 1}`,
      projectId: bp.id,
      query: k.phrase,
      clicks: Math.round(impressions * ctr),
      impressions,
      ctr,
      position: round(pos + (rng() - 0.5) * 2.4, 1),
      change: round((rng() - 0.55) * 7, 1),
      page: k.url ? k.url.replace(`https://${bp.domain}`, "") : bp.paths[0],
      country: rng() > 0.22 ? bp.countryCode : pick(rng, ["DE", "AU", "FR", "NL", "IN"]),
      device: pick(rng, ["Desktop", "Mobile", "Mobile", "Tablet"] as const),
    };
  });
}

const CONTENT_BODIES: Record<string, { title: string; keyword: string; body: string }[]> = {
  northwind: [
    {
      title: "How to Choose Hiking Boots for Every Trail",
      keyword: "hiking boots",
      body: `# How to Choose Hiking Boots

Picking the right pair of boots changes how far you can go. After 400 miles of testing on rocky ridgelines and muddy forest trails, here is the framework our team uses.

## Match the boot to the terrain

Day hikes on maintained trails need less structure than multi-day alpine routes. A mid-cut hiking boot with a flexible shank is the sweet spot for most weekend hikers, while backpackers carrying 30+ pounds should look at stiffer, full-grain leather models.

### Trail categories
- **Groomed paths:** low-cut trail shoes, 12–14 oz
- **Technical day hikes:** mid-cut with a rock plate
- **Backpacking:** full-grain leather, 3–4 lb per pair

## Fit is more important than specs

Measure your feet at the end of the day. Add a thumb's width at the toe, and test the heel lock on an incline. A great hiking boot should feel secure with zero break-in blisters.

## Waterproofing: when it helps

Gore-Tex liners keep feet dry in snow and shoulder-season slush, but they reduce breathability. In hot, dry climates a non-waterproof hiking boot dries faster and stays cooler.

## Our top picks

We compare 14 pairs each season on weight, traction, and durability.`,
    },
    {
      title: "The Trail Shell Jacket: A Field Test",
      keyword: "waterproof jacket",
      body: `# Trail Shell Jacket Field Test

We wore this shell for six weeks of Pacific Northwest rain. Here is what held up.

## Waterproofing and breathability

The 3-layer membrane rated at 20,000mm kept us dry through two atmospheric river storms. Pit zips dump heat on climbs without letting rain in.

## Weatherproofing details

A helmet-compatible hood, fully taped seams, and a storm flap over the main zipper make the difference in sideways rain. The cuffs adjust with one hand.

## Weight and packability

At 11.2 oz it packs into its own pocket. That is light enough to carry year-round.

## Where it falls short

There is no interior chest pocket, and the fit runs slim. Size up if you layer a puffy underneath.`,
    },
    {
      title: "Lightweight Camping Checklist",
      keyword: "camping tent",
      body: `# Lightweight Camping Checklist for Two Nights

A practical packing framework for a two-night trip with a base weight under 15 pounds.

## Shelter

A two-person camping tent under 4 pounds is the foundation. Look for a freestanding design, a full-coverage rainfly, and at least two vents to manage condensation.

## Sleep system

- 20°F down sleeping bag
- Insulated pad with an R-value above 3.5
- Pillow stuff sack

## Kitchen

A 3.5 oz canister stove, titanium pot, and a lighter. Add a small repair kit.

## Leave room for margin

Pack one layer warmer than the forecast suggests.`,
    },
  ],
  lumen: [
    {
      title: "Funnel Analysis: A Practical Guide",
      keyword: "funnel analysis",
      body: `# Funnel Analysis: A Practical Guide

Funnel analysis tells you exactly where users drop out of your product experience. This guide covers the models that actually drive decisions.

## Define the funnel around a decision

Start with one activation event and work backwards. A signup → first project → invite → weekly active funnel is more actionable than a generic page-view funnel.

## Step conversion benchmarks

Track step-to-step conversion, not just end-to-end. A drop from 62% to 48% at the invite step points at a specific product surface.

## Segment before you conclude

Switch to cohort analysis by acquisition channel, plan, and company size. Aggregate funnels hide the segments that actually convert.

## Close the loop with experiments

Every drop-off becomes a hypothesis. Use feature flags and A/B testing to validate the fix before investing in a rebuild.

## Instrumentation checklist

1. Name events consistently
2. Capture properties, not page paths
3. Backfill historical data from your warehouse`,
    },
    {
      title: "Cohort Analysis for SaaS Teams",
      keyword: "cohort analysis",
      body: `# Cohort Analysis for SaaS Teams

Retention is the only metric that compounds. Cohort analysis shows whether product changes improve retention for new users.

## Build time-based cohorts

Group users by signup week, then measure the percentage active in each subsequent week. A flat tail indicates product-market fit; a declining curve signals a gap in ongoing value.

## Segment by activation

Split cohorts into activated and non-activated users. Most retention problems are onboarding problems.

## Behavior cohorts beat demographic cohorts

Group by actions taken in the first 7 days. Users who create a dashboard in week one retain 3x better.

## What to do with the insight

Map each cohort to a lifecycle campaign. Then measure the impact using the same cohort definition.`,
    },
    {
      title: "Tracking Plan Template",
      keyword: "tracking plan",
      body: `# Tracking Plan Template

A tracking plan keeps analytics, product, and engineering aligned on what is measured.

## Start with the event taxonomy

Use an Object-Action naming convention: project_created, report_shared, invite_sent. Avoid generic names like click or submit.

## Document properties

Every event should define required properties, type, and example values. Include a source system (client, server, warehouse).

## Governance

- Assign an owner per event family
- Version the plan in your repo
- Review new events in weekly product sync

## Validation

Reconcile event volume against your warehouse tables weekly. Alert when a core event drops more than 30%.`,
    },
  ],
  verdant: [
    {
      title: "Monstera Care Guide for Real Homes",
      keyword: "monstera care",
      body: `# Monstera Care Guide

Monstera deliciosa is forgiving, but it still needs the right light and watering rhythm to develop those iconic split leaves.

## Light

Bright, indirect light is ideal. A spot within two feet of an east-facing window produces the largest fenestrations, while direct summer sun can scorch leaves.

## Watering

Water when the top two inches of soil are dry. In winter, reduce frequency by half. Always use a pot with a drainage hole to avoid root rot.

## Humidity and support

Monstera prefers 50–70% humidity. Add a moss pole and mist during dry months.

## Fertilizer

Feed every four weeks in spring and summer with a balanced houseplant fertilizer. Stop in fall.

## Common mistakes

Overwatering is the number one cause of decline. Yellow lower leaves usually mean soggy soil, not a lack of nutrients.`,
    },
    {
      title: "Raised Garden Bed Setup, Start to Finish",
      keyword: "raised garden bed",
      body: `# Raised Garden Bed Setup

Raised beds warm faster in spring, drain better, and save your back. Here is how to build one in a weekend.

## Size and placement

Build beds 4 feet wide and 10 feet long so you can reach the middle from both sides. Choose a spot with 6+ hours of sun.

## Materials

Cedar or metal beds resist rot. Avoid pressure-treated wood for edibles. Line the bottom with cardboard to suppress weeds.

## Soil mix

Use 60% topsoil, 30% compost, and 10% perlite for drainage. Fill to within two inches of the rim.

## Irrigation

A drip irrigation line on a timer cuts water use by up to 40% compared to overhead watering.

## Planting

Plant tall crops on the north side so they do not shade shorter plants.`,
    },
    {
      title: "Composting 101: What Works",
      keyword: "compost bin",
      body: `# Composting 101

Composting turns kitchen scraps into black gold in three to six months.

## Choose a bin

Tumblers are fast and pest-resistant. Open bins are cheap but need turning.

## Balance greens and browns

Aim for 2–3 parts brown material to 1 part green. Brown leaves, cardboard, and straw supply carbon; grass clippings and food scraps supply nitrogen.

## Manage moisture

The pile should feel like a wrung-out sponge. Too dry and it stalls; too wet and it turns anaerobic.

## Common mistakes

- Adding dairy, meat, or pet waste
- Skipping turns for weeks
- Adding oversized chunks

## When is it done?

Finished compost is dark, crumbly, and smells like soil.`,
    },
  ],
};

function generateContentDocs(bp: Blueprint): ContentDoc[] {
  const rng = rngFor("content", bp.id);
  const docs = CONTENT_BODIES[bp.id];
  return docs.map((d, i) => {
    const body = d.body;
    return {
      id: `doc_${bp.id}_${i + 1}`,
      projectId: bp.id,
      title: d.title,
      targetKeyword: d.keyword,
      body,
      status: i === 2 ? "draft" : i === 0 ? "published" : "optimized",
      score: [86, 74, 61][i] + randInt(rng, -4, 4),
      createdAt: isoDaysAgo(30 - i * 6),
      updatedAt: isoDaysAgo(5 - i),
      authorId: i === 1 ? "u_marcus" : "u_sofia",
      wordCount: body.split(/\s+/).length,
    };
  });
}

function generateReports(bp: Blueprint): Report[] {
  const rng = rngFor("reports", bp.id);
  const accent = bp.color;
  const clientName = bp.id === "northwind" ? "Northwind Outdoors" : bp.id === "lumen" ? "Lumen Analytics" : "Verdant Home";
  return [
    {
      id: `rep_${bp.id}_1`,
      projectId: bp.id,
      publicToken: `rpt_${bp.id}_${hashString(bp.id + "q").toString(36)}`,
      name: "Monthly performance review",
      clientName,
      period: "Last 30 days",
      sections: ["visibility", "rankings", "gsc", "keywords", "audits", "backlinks"],
      accent,
      logoText: bp.name,
      footerNote: "Prepared by DRIPS · Confidential",
      status: "published",
      schedule: { enabled: true, frequency: "monthly", recipients: ["client@example.com", "avery@drips.app"], nextRun: isoDaysAgo(-4, 8) },
      createdAt: isoDaysAgo(62),
      lastSent: isoDaysAgo(9, 8),
    },
    {
      id: `rep_${bp.id}_2`,
      projectId: bp.id,
      publicToken: `rpt_${bp.id}_${hashString(bp.id + "w").toString(36)}`,
      name: "Weekly wins & next actions",
      clientName,
      period: "Last 7 days",
      sections: ["visibility", "rankings", "reports", "audits"],
      accent,
      logoText: bp.name,
      footerNote: "Prepared by DRIPS · Confidential",
      status: "published",
      schedule: { enabled: true, frequency: "weekly", recipients: ["client@example.com"], nextRun: isoDaysAgo(-2, 8) },
      createdAt: isoDaysAgo(190),
      lastSent: isoDaysAgo(2, 8),
    },
    {
      id: `rep_${bp.id}_3`,
      projectId: bp.id,
      publicToken: `rpt_${bp.id}_${hashString(bp.id + "e").toString(36)}`,
      name: "Q4 strategy deck",
      clientName,
      period: "Last 90 days",
      sections: ["visibility", "competitors", "keywords", "backlinks", "audits"],
      accent: "#818CF8",
      logoText: bp.name,
      footerNote: "Draft · internal review",
      status: "draft",
      schedule: { enabled: false, frequency: "monthly", recipients: [], nextRun: null },
      createdAt: isoDaysAgo(3 + randInt(rng, 0, 3)),
      lastSent: null,
    },
  ];
}

function generateAiPrompts(bp: Blueprint): AiPrompt[] {
  const rng = rngFor("ai", bp.id);
  const engines = ["ChatGPT", "Perplexity", "Gemini", "AI Overviews", "Copilot"] as const;
  return range(14).map((i) => {
    const seed = bp.seeds[i % bp.seeds.length];
    const prompt =
      i % 3 === 0
        ? `What is the best ${seed.term} for ${bp.id === "lumen" ? "a B2B SaaS team" : "a beginner"}?`
        : i % 3 === 1
          ? `Recommend ${seed.term} brands and explain why`
          : `Compare ${seed.term} options in ${bp.country}`;
    const mentioned = rng() > 0.42;
    return {
      id: `ai_${bp.id}_${i + 1}`,
      projectId: bp.id,
      prompt,
      engine: engines[i % engines.length],
      volume: randInt(rng, 3, 90) * 100,
      mentioned,
      position: mentioned ? randInt(rng, 1, 7) : null,
      sentiment: mentioned ? (rng() > 0.25 ? "positive" : "neutral") : "absent",
      citedUrl: mentioned ? `https://${bp.domain}${bp.paths[i % bp.paths.length]}` : null,
      competitorsMentioned: range(randInt(rng, 0, 3)).map((c) => bp.comps[(i + c) % bp.comps.length].name),
      updatedAt: isoDaysAgo(randInt(rng, 0, 6)),
    };
  });
}

/* ----------------------------------------------------------------------------
 * Assemble database
 * -------------------------------------------------------------------------- */

export function buildDatabase(): Database {
  const users: User[] = USERS;
  const projects: Project[] = [];
  const keywords: Keyword[] = [];
  const audits: Audit[] = [];
  const competitors: Competitor[] = [];
  const backlinks: Backlink[] = [];
  const gscQueries: GscQuery[] = [];
  const contentDocs: ContentDoc[] = [];
  const reports: Report[] = [];
  const aiPrompts: AiPrompt[] = [];
  const widgets: Widget[] = [];

  BLUEPRINTS.forEach((bp, pi) => {
    const created = isoDaysAgo(420 - pi * 60);
    projects.push({
      id: bp.id,
      name: bp.name,
      domain: bp.domain,
      color: bp.color,
      country: bp.country,
      countryCode: bp.countryCode,
      language: bp.language,
      createdAt: created,
      members: bp.seats.map((role, idx) => ({
        userId: USERS[idx === 3 && bp.id === "northwind" ? 4 : idx + 1]?.id ?? "u_avery",
        role,
      })),
      competitors: bp.comps.slice(0, 4).map((c) => c.domain),
      gsc: {
        connected: true,
        property: `sc-domain:${bp.domain}`,
        lastSync: isoDaysAgo(0, 6),
      },
      wp: {
        connected: bp.id === "northwind",
        url: bp.id === "northwind" ? "https://northwindoutdoors.com" : null,
        version: bp.id === "northwind" ? "1.8.2" : null,
        lastPing: bp.id === "northwind" ? isoDaysAgo(0, 10) : null,
      },
      clientReportSchedule: bp.id === "verdant" ? "monthly" : "weekly",
      brandColor: bp.color,
    });

    const kws = generateKeywords(bp);
    keywords.push(...kws);
    audits.push(generateAudit(bp, 0, bp.id, "u_sofia"), generateAudit(bp, 1, bp.id, "u_priya"));
    competitors.push(...generateCompetitors(bp));
    backlinks.push(...generateBacklinks(bp));
    gscQueries.push(...generateGsc(bp, kws));
    contentDocs.push(...generateContentDocs(bp));
    reports.push(...generateReports(bp));
    aiPrompts.push(...generateAiPrompts(bp));
  });

  widgets.push(
    { id: "w_1", projectId: "northwind", publicToken: "wgt_rank_9f2a", name: "Homepage rank snapshot", type: "rank_snapshot", theme: "dark", accent: "#4ADE80", createdAt: isoDaysAgo(40) },
    { id: "w_2", projectId: "northwind", publicToken: "wgt_auth_4c81", name: "Domain authority badge", type: "authority", theme: "light", accent: "#4ADE80", createdAt: isoDaysAgo(26) },
    { id: "w_3", projectId: "verdant", publicToken: "wgt_local_7b03", name: "Local visibility grid", type: "local_grid", theme: "dark", accent: "#FBBF24", createdAt: isoDaysAgo(12) },
  );

  const tasks: Task[] = [
    { id: "t_1", projectId: "northwind", title: "Fix 404 links in hiking boot collection", description: "12 internal links point to retired product URLs. Update to new collection paths and add 301s.", status: "in_progress", priority: "high", assigneeId: "u_sofia", createdBy: "u_priya", due: isoDaysAgo(-2), createdAt: isoDaysAgo(4), tag: "Technical SEO" },
    { id: "t_2", projectId: "northwind", title: "Refresh 'best hiking boots' guide for 2026", description: "Add comparison table, update prices, embed product schema. Target top 3 for the head term.", status: "review", priority: "high", assigneeId: "u_marcus", createdBy: "u_avery", due: isoDaysAgo(-1), createdAt: isoDaysAgo(7), tag: "Content" },
    { id: "t_3", projectId: "northwind", title: "Build backlink outreach list (outdoor bloggers)", description: "Identify 40 domains with DR 40+ linking to competitors but not us.", status: "todo", priority: "medium", assigneeId: "u_priya", createdBy: "u_avery", due: isoDaysAgo(-6), createdAt: isoDaysAgo(3), tag: "Link building" },
    { id: "t_4", projectId: "lumen", title: "Publish funnel analysis comparison page", description: "Target 'funnel analysis tools' — currently position 14. Add schema and internal links.", status: "todo", priority: "high", assigneeId: "u_marcus", createdBy: "u_priya", due: isoDaysAgo(-9), createdAt: isoDaysAgo(5), tag: "Content" },
    { id: "t_5", projectId: "lumen", title: "Resolve cannibalisation: cohort analysis pages", description: "Two blog posts target the same query. Merge and 301 the weaker URL.", status: "done", priority: "medium", assigneeId: "u_sofia", createdBy: "u_priya", due: isoDaysAgo(6), createdAt: isoDaysAgo(18), tag: "Technical SEO" },
    { id: "t_6", projectId: "verdant", title: "Optimise LCP on plant care template", description: "Hero image 1.4MB. Convert to AVIF and preload. Target LCP under 2.0s.", status: "in_progress", priority: "high", assigneeId: "u_sofia", createdBy: "u_avery", due: isoDaysAgo(-4), createdAt: isoDaysAgo(6), tag: "Performance" },
    { id: "t_7", projectId: "verdant", title: "Draft native plant landing page", description: "Cluster opportunity: 14k combined volume, difficulty 28. Build hub + 4 supporting posts.", status: "review", priority: "medium", assigneeId: "u_marcus", createdBy: "u_priya", due: isoDaysAgo(-12), createdAt: isoDaysAgo(11), tag: "Content" },
    { id: "t_8", projectId: "verdant", title: "Set up monthly client report recipients", description: "Add new stakeholder emails and enable white-label branding.", status: "done", priority: "low", assigneeId: "u_avery", createdBy: "u_priya", due: isoDaysAgo(10), createdAt: isoDaysAgo(21), tag: "Reporting" },
  ];

  const activity: Activity[] = [
    { id: "a_1", projectId: "northwind", actorId: "u_sofia", action: "completed site audit", target: "Full site crawl · score 78", kind: "audit", at: isoDaysAgo(0, 8) },
    { id: "a_2", projectId: "northwind", actorId: "u_marcus", action: "optimized content", target: "How to Choose Hiking Boots", kind: "content", at: isoDaysAgo(0, 7) },
    { id: "a_3", projectId: "lumen", actorId: "u_priya", action: "connected Search Console", target: "sc-domain:lumenanalytics.io", kind: "integration", at: isoDaysAgo(1, 15) },
    { id: "a_4", projectId: "northwind", actorId: "u_avery", action: "tracked new keywords", target: "+14 keywords in Hiking footwear", kind: "keyword", at: isoDaysAgo(1, 11) },
    { id: "a_5", projectId: "verdant", actorId: "u_sofia", action: "fixed 9 broken links", target: "Garden build cluster", kind: "audit", at: isoDaysAgo(2, 9) },
    { id: "a_6", projectId: "lumen", actorId: "u_marcus", action: "published white-label report", target: "Monthly performance review", kind: "report", at: isoDaysAgo(2, 8) },
    { id: "a_7", projectId: "northwind", actorId: "u_priya", action: "invited teammate", target: "Jonas Weber as Viewer", kind: "team", at: isoDaysAgo(3, 16) },
    { id: "a_8", projectId: "verdant", actorId: "u_avery", action: "added competitor", target: "thespruce.com", kind: "keyword", at: isoDaysAgo(4, 14) },
    { id: "a_9", projectId: "northwind", actorId: "u_avery", action: "sent client report", target: "Weekly wins & next actions", kind: "report", at: isoDaysAgo(5, 8) },
    { id: "a_10", projectId: "lumen", actorId: "u_sofia", action: "installed WordPress connector", target: "lumenanalytics.io", kind: "integration", at: isoDaysAgo(6, 12) },
  ];

  const comments: Comment[] = [
    { id: "c_1", projectId: "northwind", entityType: "content", entityId: "doc_northwind_1", userId: "u_priya", text: "Add the 2026 comparison table before publishing — we're 3 keywords away from page one.", at: isoDaysAgo(0, 9) },
    { id: "c_2", projectId: "northwind", entityType: "audit", entityId: "audit_northwind_1", userId: "u_marcus", text: "I'll handle the meta descriptions for the 9 collection pages this sprint.", at: isoDaysAgo(1, 13) },
    { id: "c_3", projectId: "lumen", entityType: "report", entityId: "rep_lumen_1", userId: "u_avery", text: "Client asked to highlight AI Overviews visibility this month.", at: isoDaysAgo(2, 10) },
  ];

  return { users, projects, keywords, audits, competitors, backlinks, gscQueries, contentDocs, reports, widgets, tasks, activity, comments, aiPrompts };
}

export { USERS, ISSUE_CATALOG, dayKey };
