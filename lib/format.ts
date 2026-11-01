export function fmtNumber(n: number, digits = 0): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(n / 1_000)}k`;
  return `${Math.round(n)}`;
}

function trim(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

export function fmtCurrency(n: number, digits = 2): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function fmtPct(n: number, digits = 1): string {
  return `${n > 0 && digits >= 0 ? "" : ""}${n.toFixed(digits)}%`;
}

export function fmtSigned(n: number, digits = 0): string {
  const v = n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return n > 0 ? `+${v}` : v;
}

export function fmtDate(iso: string | null, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", opts ?? { month: "short", day: "numeric", year: "numeric" });
}

export function fmtShortDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtRelative(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export function pluralize(n: number, word: string, plural?: string): string {
  return `${fmtNumber(n)} ${n === 1 ? word : plural ?? `${word}s`}`;
}

/** Tailwind text colour for a movement value where positive is good. */
export function deltaTone(n: number, invert = false): string {
  if (n === 0) return "text-muted";
  const good = invert ? n < 0 : n > 0;
  return good ? "text-brand" : "text-rose";
}

export function scoreTone(score: number): { text: string; bg: string; ring: string; hex: string } {
  if (score >= 90) return { text: "text-brand", bg: "bg-brand/10", ring: "ring-brand/30", hex: "#4ADE80" };
  if (score >= 75) return { text: "text-sky", bg: "bg-sky/10", ring: "ring-sky/30", hex: "#38BDF8" };
  if (score >= 50) return { text: "text-amber", bg: "bg-amber/10", ring: "ring-amber/30", hex: "#FBBF24" };
  return { text: "text-rose", bg: "bg-rose/10", ring: "ring-rose/30", hex: "#FB7185" };
}

export function severityTone(severity: string): string {
  switch (severity) {
    case "critical":
      return "border-rose/30 bg-rose/10 text-rose";
    case "warning":
      return "border-amber/30 bg-amber/10 text-amber";
    default:
      return "border-sky/30 bg-sky/10 text-sky";
  }
}

export function intentTone(intent: string): string {
  switch (intent) {
    case "transactional":
      return "border-brand/25 bg-brand/10 text-brand";
    case "commercial":
      return "border-iris/25 bg-iris/10 text-iris";
    case "navigational":
      return "border-amber/25 bg-amber/10 text-amber";
    default:
      return "border-sky/25 bg-sky/10 text-sky";
  }
}

export function difficultyTone(d: number): string {
  if (d >= 70) return "text-rose";
  if (d >= 45) return "text-amber";
  return "text-brand";
}

export function positionTone(p: number | null): string {
  if (p === null) return "text-faint border-line bg-raised/50";
  if (p <= 3) return "text-brand border-brand/30 bg-brand/10";
  if (p <= 10) return "text-sky border-sky/30 bg-sky/10";
  if (p <= 20) return "text-iris border-iris/30 bg-iris/10";
  if (p <= 50) return "text-amber border-amber/30 bg-amber/10";
  return "text-rose border-rose/30 bg-rose/10";
}

export function positionHex(p: number | null): string {
  if (p === null) return "#5C6C7C";
  if (p <= 3) return "#4ADE80";
  if (p <= 10) return "#38BDF8";
  if (p <= 20) return "#818CF8";
  if (p <= 50) return "#FBBF24";
  return "#FB7185";
}

export function intentLabel(intent: string): string {
  return intent.charAt(0).toUpperCase() + intent.slice(1);
}
