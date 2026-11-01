"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { fmtCompact, fmtNumber, fmtShortDate } from "@/lib/format";

/* ---------------------------------------------------------------- utilities */

function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth(w);
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

const path = (points: { x: number; y: number }[]) =>
  points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

const smoothPath = (points: { x: number; y: number }[]) => {
  if (points.length < 2) return path(points);
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
};


export type ChartFormat = "compact" | "number" | "percent" | "percent1" | "rank" | "position" | "ms" | "usd";

function applyFormat(format: ChartFormat | undefined, n: number): string {
  switch (format) {
    case "percent":
      return `${Math.round(n)}%`;
    case "percent1":
      return `${n.toFixed(1)}%`;
    case "rank":
      return `#${Math.round(n)}`;
    case "position":
      return n >= 100 ? "Not ranked" : `#${n.toFixed(1)}`;
    case "ms":
      return `${Math.round(n)}ms`;
    case "usd":
      return `$${n.toFixed(2)}`;
    case "number":
      return fmtNumber(n);
    default:
      return fmtCompact(n);
  }
}

/* -------------------------------------------------------------- Sparkline */

export function Sparkline({
  data,
  color = "#4ADE80",
  width = 96,
  height = 28,
  fill = true,
  strokeWidth = 1.6,
  invert = false,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  strokeWidth?: number;
  invert?: boolean;
}) {
  if (!data.length) return <div style={{ width, height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = 2;
  const points = data.map((v, i) => ({
    x: (i / Math.max(1, data.length - 1)) * (width - pad * 2) + pad,
    y: pad + ((invert ? max - v : v - min) / span) * (height - pad * 2),
  }));
  const id = `spark-${color.replace("#", "")}-${data.length}-${Math.round(min * 10)}`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && (
        <path d={`${smoothPath(points)} L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`} fill={`url(#${id})`} />
      )}
      <path d={smoothPath(points)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

/* -------------------------------------------------------------- AreaChart */

export type Series = { name: string; color: string; values: number[]; dashed?: boolean };

export function AreaChart({
  series,
  labels,
  height = 220,
  format = "compact",
  invertY = false,
  showLegend = true,
  yTicks = 4,
  area = true,
  rightLabels,
}: {
  series: Series[];
  labels: string[];
  height?: number;
  format?: ChartFormat;
  invertY?: boolean;
  showLegend?: boolean;
  yTicks?: number;
  area?: boolean;
  rightLabels?: string[];
}) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const hasData = labels.length > 1 && series.some((s) => s.values.length > 0);
  const pad = { top: 12, right: 8, bottom: 24, left: 40 };
  const w = Math.max(width, 240);
  const innerW = w - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  if (!hasData) {
    return (
      <div ref={ref} className="flex w-full items-center justify-center rounded-lg border border-dashed border-line text-[11.5px] text-faint" style={{ height }}>
        Not enough data yet — run a refresh to populate this chart.
      </div>
    );
  }
  const all = series.flatMap((s) => s.values);
  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);
  const min = rawMin === rawMax ? rawMin - 1 : rawMin;
  const max = rawMax === rawMin ? rawMax + 1 : rawMax;
  const paddedMin = invertY ? Math.max(0, min - (max - min) * 0.08) : min - (max - min) * 0.08;
  const paddedMax = max + (max - min) * 0.08;
  const ticks = niceTicks(paddedMin, paddedMax, yTicks);

  const xFor = (i: number, len: number) => pad.left + (i / Math.max(1, len - 1)) * innerW;
  const yFor = (v: number) =>
    pad.top + innerH - ((v - paddedMin) / (paddedMax - paddedMin || 1)) * innerH;

  const labelStep = Math.ceil(labels.length / Math.max(4, Math.floor(innerW / 70)));

  return (
    <div ref={ref} className="w-full">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * w;
          const idx = Math.round(((x - pad.left) / innerW) * (labels.length - 1));
          setHover(Math.max(0, Math.min(labels.length - 1, idx)));
        }}
      >
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.name} id={`area-${i}-${s.color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.01" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={w - pad.right} y1={yFor(t)} y2={yFor(t)} stroke="rgb(var(--line))" strokeWidth="1" strokeDasharray="3 5" />
            <text x={pad.left - 8} y={yFor(t) + 3.5} textAnchor="end" fontSize="10" fill="rgb(var(--faint))" className="tabular">
              {applyFormat(format, t)}
            </text>
          </g>
        ))}
        {series.map((s, si) => {
          const pts = s.values.map((v, i) => ({ x: xFor(i, s.values.length), y: yFor(v) }));
          return (
            <g key={s.name}>
              {area && !s.dashed && (
                <path
                  d={`${smoothPath(pts)} L${pts[pts.length - 1].x},${pad.top + innerH} L${pts[0].x},${pad.top + innerH} Z`}
                  fill={`url(#area-${si}-${s.color.replace("#", "")})`}
                />
              )}
              <path
                d={smoothPath(pts)}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dashed ? "4 4" : undefined}
                strokeLinecap="round"
              />
            </g>
          );
        })}
        {labels.map((l, i) =>
          i % labelStep === 0 || i === labels.length - 1 ? (
            <text key={`${l}-${i}`} x={xFor(i, labels.length)} y={height - 6} textAnchor="middle" fontSize="10" fill="rgb(var(--faint))">
              {l.length > 7 ? fmtShortDate(l) : l}
            </text>
          ) : null,
        )}
        {hover !== null && (
          <g>
            <line x1={xFor(hover, labels.length)} x2={xFor(hover, labels.length)} y1={pad.top} y2={pad.top + innerH} stroke="rgb(var(--muted))" strokeWidth="1" strokeDasharray="3 3" />
            {series.map((s) => (
              <circle key={s.name} cx={xFor(hover, labels.length)} cy={yFor(s.values[hover])} r="3.5" fill="rgb(var(--surface))" stroke={s.color} strokeWidth="2" />
            ))}
          </g>
        )}
      </svg>
      <div className="mt-1 flex min-h-[20px] items-start justify-between gap-3">
        {hover !== null ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]">
            <span className="text-muted">{labels[hover]}</span>
            {series.map((s) => (
              <span key={s.name} className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                <span className="text-muted">{s.name}</span>
                <span className="font-medium tabular-nums">{applyFormat(format, s.values[hover])}</span>
              </span>
            ))}
          </div>
        ) : (
          showLegend && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted">
              {series.map((s) => (
                <span key={s.name} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </span>
              ))}
            </div>
          )
        )}
        {rightLabels && <div className="text-[11px] text-faint">{rightLabels[hover ?? 0]}</div>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- BarChart */

export function BarChart({
  data,
  height = 180,
  color = "#4ADE80",
  format = "compact",
  labelFormat,
}: {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  color?: string;
  format?: ChartFormat;
  labelFormat?: ChartFormat;
}) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const w = Math.max(width, 240);
  const pad = { top: 10, right: 6, bottom: 22, left: 36 };
  const innerW = w - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(...data.map((d) => d.value), 1);
  const ticks = niceTicks(0, max, 3);
  const bw = innerW / Math.max(data.length, 1);
  const yFor = (v: number) => pad.top + innerH - (v / (max || 1)) * innerH;
  const labelStep = Math.ceil(data.length / Math.max(4, Math.floor(innerW / 60)));

  return (
    <div ref={ref} className="relative w-full">
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={w - pad.right} y1={yFor(t)} y2={yFor(t)} stroke="rgb(var(--line))" strokeDasharray="3 5" />
            <text x={pad.left - 6} y={yFor(t) + 3} textAnchor="end" fontSize="10" fill="rgb(var(--faint))">
              {applyFormat(format, t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = Math.max(1, (d.value / (max || 1)) * innerH);
          const x = pad.left + i * bw + bw * 0.18;
          const bwid = bw * 0.64;
          return (
            <g key={`${d.label}-${i}`} onMouseEnter={() => setHover(i)}>
              <rect x={pad.left + i * bw} y={pad.top} width={bw} height={innerH} fill="transparent" />
              <rect
                x={x}
                y={pad.top + innerH - h}
                width={bwid}
                height={h}
                rx={Math.min(3, bwid / 2)}
                fill={d.color ?? color}
                opacity={hover === null || hover === i ? 0.9 : 0.35}
              />
              {(i % labelStep === 0 || i === data.length - 1) && (
                <text x={pad.left + i * bw + bw / 2} y={height - 6} textAnchor="middle" fontSize="10" fill="rgb(var(--faint))">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-md border border-line bg-panel px-2 py-1 text-[11px] shadow-pop"
          style={{ left: `${((pad.left + hover * bw + bw / 2) / w) * 100}%`, transform: "translateX(-50%)" }}
        >
          <span className="text-muted">{data[hover].label}: </span>
          <span className="font-medium tabular-nums">{applyFormat(labelFormat, data[hover].value)}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- Donut */

export function Donut({
  segments,
  size = 132,
  thickness = 14,
  centerLabel,
  centerValue,
  gap = 2.5,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  gap?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--raised))" strokeWidth={thickness} />
          {segments.map((s) => {
            const len = (s.value / total) * c;
            const dash = Math.max(0, len - gap);
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                opacity={s.value === 0 ? 0 : 1}
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        {(centerValue || centerLabel) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue && <span className="text-[20px] font-semibold leading-none tabular-nums">{centerValue}</span>}
            {centerLabel && <span className="mt-1 text-[9px] uppercase tracking-[0.12em] text-faint">{centerLabel}</span>}
          </div>
        )}
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-2 text-[12px]">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="truncate text-muted">{s.label}</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------- StackedBar */

export function StackedBar({
  segments,
  height = 8,
  className,
}: {
  segments: { label: string; value: number; color: string }[];
  height?: number;
  className?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className={clsx("flex w-full overflow-hidden rounded-full bg-raised", className)} style={{ height }}>
      {segments.map((s) => (
        <div
          key={s.label}
          title={`${s.label}: ${s.value}`}
          className="h-full transition-all"
          style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
        />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Heatmap */

export function Heatmap({
  cells,
  size = 34,
  labels = ["A", "B", "C", "D", "E"],
}: {
  cells: (number | null)[][];
  size?: number;
  labels?: string[];
}) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const colorFor = (v: number | null) => {
    if (v === null) return "rgb(var(--raised))";
    if (v <= 3) return "#16A34A";
    if (v <= 6) return "#4ADE80";
    if (v <= 10) return "#A3E635";
    if (v <= 15) return "#FBBF24";
    if (v <= 20) return "#FB923C";
    return "#FB7185";
  };
  return (
    <div className="inline-flex flex-col gap-1">
      <div className="flex gap-1 pl-5">
        {labels.map((l) => (
          <div key={l} className="text-center text-[9px] text-faint" style={{ width: size }}>
            {l}
          </div>
        ))}
      </div>
      {cells.map((row, r) => (
        <div key={r} className="flex items-center gap-1">
          <div className="w-4 text-[9px] text-faint">{r + 1}</div>
          {row.map((v, c) => (
            <div
              key={c}
              onMouseEnter={() => setHover({ r, c })}
              onMouseLeave={() => setHover(null)}
              className="relative grid place-items-center rounded-md text-[10px] font-semibold transition"
              style={{
                width: size,
                height: size,
                background: colorFor(v),
                color: v !== null && v <= 10 ? "#052E16" : v === null ? "rgb(var(--faint))" : "#1C1917",
                opacity: hover && (hover.r !== r || hover.c !== c) ? 0.6 : 1,
              }}
              title={v ? `Rank ${v}` : "Not found"}
            >
              {v ?? "—"}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- HorizontalBars */

export function HorizontalBars({
  data,
  format = "compact",
  color = "#4ADE80",
  max: maxProp,
}: {
  data: { label: string; value: number; color?: string; sublabel?: string }[];
  format?: ChartFormat;
  color?: string;
  max?: number;
}) {
  const max = maxProp ?? Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate text-[12.5px]">{d.label}</span>
              {d.sublabel && <span className="shrink-0 text-[11px] text-faint">{d.sublabel}</span>}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
              <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: d.color ?? color }} />
            </div>
          </div>
          <span className="text-[12px] font-medium tabular-nums text-muted">{applyFormat(format, d.value)}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------- Gauge */

export function Gauge({
  value,
  max = 100,
  label,
  size = 150,
  color = "#4ADE80",
}: {
  value: number;
  max?: number;
  label?: string;
  size?: number;
  color?: string;
}) {
  const r = size / 2 - 12;
  const c = Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div className="relative" style={{ width: size, height: size / 2 + 22 }}>
      <svg width={size} height={size / 2 + 22} viewBox={`0 0 ${size} ${size / 2 + 22}`}>
        <path
          d={`M12,${size / 2 + 4} A${r},${r} 0 0 1 ${size - 12},${size / 2 + 4}`}
          fill="none"
          stroke="rgb(var(--raised))"
          strokeWidth={10}
          strokeLinecap="round"
        />
        <path
          d={`M12,${size / 2 + 4} A${r},${r} 0 0 1 ${size - 12},${size / 2 + 4}`}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
        />
        <text x={size / 2} y={size / 2 - 2} textAnchor="middle" fontSize="24" fontWeight="600" fill="rgb(var(--ink))" className="tabular">
          {Math.round(value)}
        </text>
        {label && (
          <text x={size / 2} y={size / 2 + 16} textAnchor="middle" fontSize="9" fill="rgb(var(--faint))" letterSpacing="1.2">
            {label.toUpperCase()}
          </text>
        )}
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------------- RankChart */

export function RankChart({
  points,
  height = 230,
  color = "#4ADE80",
}: {
  points: { date: string; position: number | null }[];
  height?: number;
  color?: string;
}) {
  const filled = points.map((p) => (p.position === null ? 100 : p.position));
  return (
    <AreaChart
      series={[{ name: "Average position", color, values: filled }]}
      labels={points.map((p) => p.date)}
      height={height}
      invertY
      format="rank"
      area
    />
  );
}

/* --------------------------------------------------------------- BubbleChart */

export function BubbleChart({
  data,
  height = 260,
  xLabel = "Keyword difficulty",
  yLabel = "Monthly volume",
  color = "#818CF8",
}: {
  data: { label: string; x: number; y: number; r: number; color?: string }[];
  height?: number;
  xLabel?: string;
  yLabel?: string;
  color?: string;
}) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const w = Math.max(width, 280);
  const pad = { top: 14, right: 14, bottom: 34, left: 46 };
  const innerW = w - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  if (!data.length) {
    return (
      <div ref={ref} className="flex w-full items-center justify-center rounded-lg border border-dashed border-line text-[11.5px] text-faint" style={{ height }}>
        No keywords to plot yet.
      </div>
    );
  }

  const maxX = 100;
  const logMax = Math.log10(Math.max(...data.map((d) => d.y), 10));
  const maxR = Math.max(...data.map((d) => d.r), 1);
  const xFor = (v: number) => pad.left + (v / maxX) * innerW;
  const yFor = (v: number) => pad.top + innerH - (Math.log10(Math.max(v, 10)) / logMax) * innerH;
  const rFor = (v: number) => 4 + Math.sqrt(v / maxR) * 11;

  return (
    <div ref={ref} className="relative w-full">
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} onMouseLeave={() => setHover(null)}>
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={xFor(t)} x2={xFor(t)} y1={pad.top} y2={pad.top + innerH} stroke="rgb(var(--line))" strokeDasharray="3 5" />
            <text x={xFor(t)} y={height - 18} textAnchor="middle" fontSize="9.5" fill="rgb(var(--faint))">{t}</text>
          </g>
        ))}
        {[0.25, 0.5, 0.75, 1].map((f) => {
          const val = Math.pow(10, logMax * f);
          return (
            <g key={f}>
              <line x1={pad.left} x2={w - pad.right} y1={yFor(val)} y2={yFor(val)} stroke="rgb(var(--line))" strokeDasharray="3 5" />
              <text x={pad.left - 6} y={yFor(val) + 3} textAnchor="end" fontSize="9.5" fill="rgb(var(--faint))">{fmtCompact(val)}</text>
            </g>
          );
        })}
        {data.map((d, i) => (
          <g key={`${d.label}-${i}`} onMouseEnter={() => setHover(i)}>
            <circle
              cx={xFor(d.x)}
              cy={yFor(d.y)}
              r={rFor(d.r)}
              fill={d.color ?? color}
              fillOpacity={hover === null || hover === i ? 0.34 : 0.12}
              stroke={d.color ?? color}
              strokeWidth={hover === i ? 2 : 1.2}
            />
          </g>
        ))}
        <text x={pad.left + innerW / 2} y={height - 3} textAnchor="middle" fontSize="9.5" fill="rgb(var(--faint))">{xLabel}</text>
        <text x={10} y={pad.top + innerH / 2} textAnchor="middle" fontSize="9.5" fill="rgb(var(--faint))" transform={`rotate(-90, 10, ${pad.top + innerH / 2})`}>{yLabel}</text>
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 w-44 rounded-lg border border-line bg-panel p-2 text-[11px] shadow-pop"
          style={{
            left: `${(xFor(data[hover].x) / w) * 100}%`,
            top: `${(yFor(data[hover].y) / height) * 100}%`,
            transform: "translate(-50%, -115%)",
          }}
        >
          <p className="truncate font-medium">{data[hover].label}</p>
          <p className="mt-0.5 text-faint">KD {data[hover].x} · {fmtCompact(data[hover].y)}/mo</p>
        </div>
      )}
    </div>
  );
}
