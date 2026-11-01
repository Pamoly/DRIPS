import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import clsx from "clsx";

export function Card({
  children,
  className,
  padded = true,
  id,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  id?: string;
}) {
  return <section id={id} className={clsx("card", padded && "card-pad", className)}>{children}</section>;
}

export function SectionHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold tracking-[-0.01em]">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-line/80 pb-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-faint">{eyebrow}</div>}
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.025em]">{title}</h1>
          {description && <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Delta({
  value,
  suffix = "",
  invert = false,
  className,
  showIcon = true,
}: {
  value: number;
  suffix?: string;
  invert?: boolean;
  className?: string;
  showIcon?: boolean;
}) {
  const good = invert ? value < 0 : value > 0;
  const neutral = value === 0;
  const Icon = neutral ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-0.5 text-[12px] font-medium tabular-nums",
        neutral ? "text-muted" : good ? "text-brand" : "text-rose",
        className,
      )}
    >
      {showIcon && <Icon className="h-3 w-3" strokeWidth={2.4} />}
      {value > 0 ? "+" : ""}
      {value.toLocaleString("en-US", { maximumFractionDigits: 1 })}
      {suffix}
    </span>
  );
}

export function Kpi({
  label,
  value,
  delta,
  deltaSuffix,
  invertDelta,
  hint,
  icon,
  href,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  delta?: number;
  deltaSuffix?: string;
  invertDelta?: boolean;
  hint?: ReactNode;
  icon?: ReactNode;
  href?: string;
  tone?: "neutral" | "brand" | "iris" | "sky" | "amber" | "rose";
}) {
  const toneRing: Record<string, string> = {
    neutral: "text-muted bg-raised/70",
    brand: "text-brand bg-brand/10",
    iris: "text-iris bg-iris/10",
    sky: "text-sky bg-sky/10",
    amber: "text-amber bg-amber/10",
    rose: "text-rose bg-rose/10",
  };
  const inner = (
    <div className="card-pad group relative flex h-full flex-col justify-between gap-3 overflow-hidden transition hover:border-line/80">
      <div className="flex items-start justify-between gap-3">
        <span className="label">{label}</span>
        {icon && <span className={clsx("grid h-7 w-7 place-items-center rounded-lg", toneRing[tone])}>{icon}</span>}
      </div>
      <div>
        <div className="kpi-value">{value}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-muted">
          {delta !== undefined && <Delta value={delta} suffix={deltaSuffix} invert={invertDelta} />}
          {hint && <span className="truncate">{hint}</span>}
        </div>
      </div>
    </div>
  );
  return (
    <div className="card h-full">
      {href ? (
        <Link href={href} className="block h-full">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "brand" | "iris" | "sky" | "amber" | "rose" | "outline";
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: "border-line bg-raised/70 text-muted",
    brand: "border-brand/25 bg-brand/10 text-brand",
    iris: "border-iris/25 bg-iris/10 text-iris",
    sky: "border-sky/25 bg-sky/10 text-sky",
    amber: "border-amber/25 bg-amber/10 text-amber",
    rose: "border-rose/25 bg-rose/10 text-rose",
    outline: "border-line bg-transparent text-muted",
  };
  return <span className={clsx("chip", tones[tone], className)}>{children}</span>;
}

export function Progress({
  value,
  max = 100,
  tone = "brand",
  height = 6,
  className,
}: {
  value: number;
  max?: number;
  tone?: "brand" | "sky" | "iris" | "amber" | "rose" | "muted";
  height?: number;
  className?: string;
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand",
    sky: "bg-sky",
    iris: "bg-iris",
    amber: "bg-amber",
    rose: "bg-rose",
    muted: "bg-faint",
  };
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={clsx("w-full overflow-hidden rounded-full bg-raised", className)} style={{ height }}>
      <div className={clsx("h-full rounded-full transition-all duration-500", tones[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ScoreRing({
  score,
  size = 56,
  stroke = 5,
  label,
}: {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);
  const color = score >= 90 ? "#4ADE80" : score >= 75 ? "#38BDF8" : score >= 50 ? "#FBBF24" : "#FB7185";
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(var(--line))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-semibold tabular-nums" style={{ fontSize: size * 0.3 }}>
          {Math.round(score)}
        </span>
        {label && <span className="mt-0.5 text-[8px] uppercase tracking-wider text-faint">{label}</span>}
      </div>
    </div>
  );
}

export function Avatar({
  name,
  hue = 152,
  size = 28,
  className,
}: {
  name: string;
  hue?: number;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={clsx("inline-grid shrink-0 place-items-center rounded-full font-semibold", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `hsl(${hue} 42% 22%)`,
        color: `hsl(${hue} 85% 78%)`,
        border: `1px solid hsl(${hue} 45% 34%)`,
      }}
      title={name}
    >
      {initials}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-14 text-center">
      {icon && <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-raised text-muted">{icon}</div>}
      <p className="text-[14px] font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  size = "md",
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  label?: string;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange?.(!checked)}
      className={clsx(
        "relative inline-flex shrink-0 items-center rounded-full border transition",
        size === "sm" ? "h-4 w-8" : "h-5 w-9",
        checked ? "border-brand/50 bg-brand/80" : "border-line bg-raised",
      )}
    >
      <span
        className={clsx(
          "absolute rounded-full bg-white shadow transition-all",
          size === "sm" ? "h-3 w-3" : "h-4 w-4",
          checked ? (size === "sm" ? "left-[17px]" : "left-[19px]") : "left-0.5",
        )}
      />
    </button>
  );
}

export function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/60 py-2 last:border-0">
      <span className="text-[12px] text-muted">{label}</span>
      <span className="text-right text-[12.5px] font-medium">{children}</span>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={clsx("th", className)}>{children}</th>;
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={clsx("td", className)}>{children}</td>;
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

export function Segmented({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={clsx("seg", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={clsx("seg-item", value === o.value && "seg-item-active")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: "info" | "warn" | "success" | "danger";
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const tones = {
    info: "border-sky/25 bg-sky/[0.06]",
    warn: "border-amber/25 bg-amber/[0.06]",
    success: "border-brand/25 bg-brand/[0.06]",
    danger: "border-rose/25 bg-rose/[0.06]",
  } as const;
  const dot = { info: "bg-sky", warn: "bg-amber", success: "bg-brand", danger: "bg-rose" } as const;
  return (
    <div className={clsx("flex items-start gap-3 rounded-xl border p-3.5", tones[tone])}>
      <span className={clsx("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", dot[tone])} />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium">{title}</p>
        {children && <div className="mt-0.5 text-[12px] leading-relaxed text-muted">{children}</div>}
      </div>
      {action}
    </div>
  );
}
