export type Role = "owner" | "admin" | "editor" | "viewer";
export type Intent = "informational" | "commercial" | "transactional" | "navigational";
export type Engine = "google" | "google_mobile" | "bing" | "local";
export type Severity = "critical" | "warning" | "notice";
export type TaskStatus = "todo" | "in_progress" | "review" | "done";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  hue: number;
  lastActive?: string;
  passwordHash?: string;
}

export interface ProjectMember {
  userId: string;
  role: Role;
}

export interface Project {
  id: string;
  name: string;
  domain: string;
  color: string;
  country: string;
  countryCode: string;
  language: string;
  createdAt: string;
  members: ProjectMember[];
  competitors: string[];
  gsc: { connected: boolean; property: string; lastSync: string | null };
  wp: { connected: boolean; url: string | null; version: string | null; lastPing: string | null };
  clientReportSchedule: "weekly" | "monthly" | "off";
  brandColor: string;
}

export interface Keyword {
  id: string;
  projectId: string;
  phrase: string;
  volume: number;
  cpc: number;
  difficulty: number;
  intent: Intent;
  cluster: string;
  position: number | null;
  prevPosition: number | null;
  bestPosition: number;
  url: string | null;
  country: string;
  countryCode: string;
  serpFeatures: string[];
  tracked: boolean;
  tags: string[];
  createdAt: string;
  gscClicks: number;
  gscImpressions: number;
}

export interface AuditIssue {
  id: string;
  title: string;
  category: "Technical" | "On-page" | "Performance" | "Content" | "Links" | "Security";
  severity: Severity;
  impact: "High" | "Medium" | "Low";
  affected: number;
  detail: string;
  fix: string;
  crawled: string;
}

export interface AuditPage {
  url: string;
  title: string;
  score: number;
  statusCode: number;
  responseMs: number;
  words: number;
  issues: string[];
  lcp: number;
  cls: number;
  inp: number;
}

export interface Audit {
  id: string;
  projectId: string;
  name: string;
  startUrl: string;
  createdAt: string;
  completedAt: string | null;
  status: "completed" | "running" | "queued" | "failed";
  score: number;
  pagesCrawled: number;
  issues: AuditIssue[];
  pages: AuditPage[];
  vitals: { lcp: number; cls: number; inp: number; fcp: number; ttfb: number };
  createdBy: string;
  schedule: "none" | "weekly" | "monthly";
}

export interface Competitor {
  id: string;
  projectId: string;
  domain: string;
  name: string;
  dr: number;
  traffic: number;
  keywords: number;
  visibility: number;
  backlinks: number;
  referringDomains: number;
  trend: number[];
  gapKeywords: { phrase: string; volume: number; difficulty: number; theirPosition: number; gapScore: number; intent: Intent }[];
  gained: number;
  lost: number;
}

export interface Backlink {
  id: string;
  projectId: string;
  sourceUrl: string;
  sourceDomain: string;
  targetUrl: string;
  anchor: string;
  dr: number;
  type: "dofollow" | "nofollow" | "ugc" | "sponsored";
  firstSeen: string;
  lastSeen: string;
  status: "live" | "lost" | "new";
  traffic: number;
}

export interface GscQuery {
  id: string;
  projectId: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  change: number;
  page: string;
  country: string;
  device: "Desktop" | "Mobile" | "Tablet";
}

export interface ContentDoc {
  id: string;
  projectId: string;
  title: string;
  targetKeyword: string;
  body: string;
  status: "draft" | "optimized" | "published";
  score: number;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  wordCount: number;
}

export interface Report {
  id: string;
  projectId: string;
  publicToken: string;
  name: string;
  clientName: string;
  period: "Last 7 days" | "Last 30 days" | "Last 90 days";
  sections: string[];
  accent: string;
  logoText: string;
  footerNote: string;
  status: "draft" | "published";
  schedule: { enabled: boolean; frequency: "weekly" | "monthly"; recipients: string[]; nextRun: string | null };
  createdAt: string;
  lastSent: string | null;
}

export interface Widget {
  id: string;
  projectId: string;
  publicToken: string;
  name: string;
  type: "authority" | "rank_snapshot" | "keywords" | "audit_score" | "local_grid";
  theme: "dark" | "light" | "auto";
  accent: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high";
  assigneeId: string;
  createdBy: string;
  due: string;
  createdAt: string;
  tag: string;
}

export interface Activity {
  id: string;
  projectId: string;
  actorId: string;
  action: string;
  target: string;
  kind: "audit" | "ranking" | "content" | "report" | "team" | "integration" | "keyword";
  at: string;
}

export interface Comment {
  id: string;
  projectId: string;
  entityType: "audit" | "page" | "report" | "content";
  entityId: string;
  userId: string;
  text: string;
  at: string;
}

export interface AiPrompt {
  id: string;
  projectId: string;
  prompt: string;
  engine: "ChatGPT" | "Perplexity" | "Gemini" | "AI Overviews" | "Copilot";
  volume: number;
  mentioned: boolean;
  position: number | null;
  sentiment: "positive" | "neutral" | "negative" | "absent";
  citedUrl: string | null;
  competitorsMentioned: string[];
  updatedAt: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  hue: number;
  /** True for the shared, read-only guest session. */
  isGuest?: boolean;
}

export interface Database {
  users: User[];
  projects: Project[];
  keywords: Keyword[];
  audits: Audit[];
  competitors: Competitor[];
  backlinks: Backlink[];
  gscQueries: GscQuery[];
  contentDocs: ContentDoc[];
  reports: Report[];
  widgets: Widget[];
  tasks: Task[];
  activity: Activity[];
  comments: Comment[];
  aiPrompts: AiPrompt[];
}
