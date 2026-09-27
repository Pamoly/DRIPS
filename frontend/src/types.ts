export type Severity = 'critical' | 'major' | 'minor' | 'info';

export interface Finding {
  id: string;
  rule: string;
  title: string;
  message: string;
  severity: Severity;
  category: string;
  line: number;
  column: number;
  end_line: number | null;
  snippet: string;
  why_it_matters: string;
  how_to_fix: string;
  autofixable: boolean;
  confidence: number;
  source: string;
  references: string[];
  tags: string[];
}

export interface Metrics {
  lines: number;
  code_lines: number;
  comment_lines: number;
  blank_lines: number;
  functions: number;
  classes: number;
  max_complexity: number;
  avg_complexity: number;
  max_function_length: number;
  max_nesting: number;
  docstring_coverage: number;
  comment_ratio: number;
  duplication: number;
  todo_count: number;
  imports: number;
  maintainability: number;
  extra: Record<string, any>;
}

export interface Analysis {
  path: string;
  language: string;
  findings: Finding[];
  metrics: Metrics;
  health_score: number;
  grade: string;
  summary: string;
  analyzed_at: number;
  duration_ms: number;
  revision: number;
}

export interface WorkspaceFile {
  path: string;
  content: string;
  language: string;
  updated_at: number;
  revision: number;
  health_score?: number | null;
  grade?: string | null;
  finding_count?: number;
}

export interface Patch {
  id: string;
  file_path: string;
  finding_id: string | null;
  title: string;
  rationale: string;
  diff: string;
  original: string;
  patched: string;
  confidence: number;
  risk: Severity;
  status: 'proposed' | 'approved' | 'rejected' | 'applied' | 'reverted' | 'expired';
  created_by: string;
  created_at: number;
  decided_at: number | null;
  decided_by: string | null;
  decision_note: string;
  learning_note: string;
  verification: Record<string, any>;
}

export interface ReviewComment {
  id: string;
  author: string;
  body: string;
  line: number;
  kind: 'comment' | 'suggestion' | 'blocker' | 'praise';
  resolved: boolean;
  created_at: number;
}

export interface Review {
  id: string;
  file_path: string;
  title: string;
  summary: string;
  author: string;
  reviewer: string;
  status: 'pending' | 'in-review' | 'approved' | 'changes-requested' | 'rejected';
  checklist: { label: string; done: boolean }[];
  comments: ReviewComment[];
  patch_ids: string[];
  risk: Severity;
  created_at: number;
  updated_at: number;
  decision_at: number | null;
  decision_note: string;
}

export interface Run {
  id: string;
  file_path: string;
  language: string;
  command: string;
  exit_code: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
  timed_out: boolean;
  created_at: number;
  traceback_summary: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  actor: string;
  target: string;
  detail: string;
  created_at: number;
  metadata: Record<string, any>;
}

export interface Learner {
  id: string;
  name: string;
  level_n: number;
  title: string;
  xp: number;
  streak_days: number;
  skills: Record<string, number>;
  badges: { id: string; name: string; description: string; icon: string; earned_at: number }[];
  completed_lessons: string[];
  updated_at: number;
}

export interface Level {
  n: number;
  title: string;
  focus: string;
  xp: number;
  next: { n: number; title: string; xp: number } | null;
  progress_to_next: number;
}

export interface Overview {
  files: number;
  analyzed: number;
  average_health: number | null;
  grade: string | null;
  findings: number;
  severities: Record<Severity, number>;
  pending_patches: number;
  approved_patches: number;
  open_reviews: number;
  hotspots: { path: string; health_score: number; grade: string; top_issue: string }[];
  autonomy: string;
  note: string;
  duplicates?: Finding[];
  maintainability?: number | null;
  critical_findings?: number;
}

export interface StepEvent {
  index: number;
  status: 'running' | 'done' | 'failed';
  agent: string;
  action: string;
  detail: string;
  xp?: number;
}

export interface ChatEvent {
  type: string;
  [key: string]: any;
}

export interface AgentMessage {
  agent: string;
  headline: string;
  markdown: string;
  data: Record<string, any>;
  follow_ups: string[];
  xp?: number;
}

export interface Lesson {
  id: string;
  title: string;
  skill: string;
  minutes: number;
  why: string;
  read?: string[];
  practice?: string;
  check?: string;
  rules?: string[];
  matched_findings?: number;
  completed?: boolean;
}

export interface Track {
  id: string;
  name: string;
  level: string;
  summary: string;
  lessons: Lesson[];
}

export interface LearningPayload {
  learner: Learner;
  level: Level;
  levels: { n: number; title: string; xp: number; focus: string }[];
  badges: { id: string; name: string; description: string; icon: string }[];
  tracks: Track[];
  recommended_track: { id: string; name: string; reason: string };
  next_lessons: Lesson[];
}
