"use client";

// Lightweight SVG charts (no chart library) with interactive hover tooltips.
// Themed via CSS variables (see globals.css) so they restyle with dark/light.
// Hovering reveals each data point one at a time.

import { useState } from "react";

const PURPLE = "#8b5cf6";
const PURPLE_SOFT = "#c4b5fd";
const FUCHSIA = "#d946ef";

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const cx = (p0.x + p1.x) / 2;
    d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

// Floating tooltip positioned by percentage of the chart container, so it
// tracks the SVG as it scales responsively.
function Tip({
  xPct,
  yPct,
  title,
  value,
}: {
  xPct: number;
  yPct: number;
  title: string;
  value: string;
}) {
  return (
    <div
      className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-ink-700 bg-ink-900 px-2.5 py-1.5 text-xs shadow-xl shadow-black/20"
      style={{ left: `${xPct}%`, top: `${yPct}%`, transform: "translate(-50%, -130%)" }}
    >
      <div className="font-semibold text-ink-100">{title}</div>
      <div className="text-ink-300">{value}</div>
    </div>
  );
}

export function AreaChart({
  values,
  labels,
  height = 190,
  valueSuffix = "",
}: {
  values: number[];
  labels: string[];
  height?: number;
  valueSuffix?: string;
}) {
  const [hi, setHi] = useState<number | null>(null);
  const w = 640;
  const h = height;
  const pad = { top: 12, right: 12, bottom: 26, left: 40 };
  const max = Math.max(...values, 1);
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  const points = values.map((v, i) => ({
    x: pad.left + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW),
    y: pad.top + innerH - (v / max) * innerH,
  }));

  const line = smoothPath(points);
  const area = `${line} L ${points[points.length - 1].x} ${pad.top + innerH} L ${points[0].x} ${pad.top + innerH} Z`;
  const gid = `grad-${values.join("-").slice(0, 24)}`;

  return (
    <div className="relative" onMouseLeave={() => setHi(null)}>
      <svg viewBox={`0 0 ${w} ${h}`} className="block w-full" role="img">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PURPLE} stopOpacity="0.35" />
            <stop offset="100%" stopColor={PURPLE} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line
              x1={pad.left}
              x2={w - pad.right}
              y1={pad.top + innerH * t}
              y2={pad.top + innerH * t}
              style={{ stroke: "var(--chart-grid)" }}
              strokeDasharray="3 4"
            />
            <text x={pad.left - 8} y={pad.top + innerH * t + 4} textAnchor="end" fontSize="10" style={{ fill: "var(--chart-label)" }}>
              {Math.round(max * (1 - t) * 10) / 10}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={PURPLE} strokeWidth="2.5" strokeLinecap="round" />

        {hi !== null && (
          <g>
            <line x1={points[hi].x} x2={points[hi].x} y1={pad.top} y2={pad.top + innerH} stroke={PURPLE} strokeOpacity="0.4" strokeWidth="1.5" />
            <circle cx={points[hi].x} cy={points[hi].y} r="4.5" fill={PURPLE} stroke="#fff" strokeWidth="1.5" />
          </g>
        )}

        {labels.map((label, i) => (
          <text
            key={i}
            x={pad.left + (labels.length === 1 ? innerW / 2 : (i / (labels.length - 1)) * innerW)}
            y={h - 8}
            textAnchor="middle"
            fontSize="10"
            style={{ fill: "var(--chart-label)" }}
          >
            {label}
          </text>
        ))}

        {/* Transparent hit slices — hovering one selects that data point. */}
        {points.map((p, i) => {
          const x0 = i === 0 ? pad.left : (points[i - 1].x + p.x) / 2;
          const x1 = i === points.length - 1 ? pad.left + innerW : (p.x + points[i + 1].x) / 2;
          return (
            <rect
              key={i}
              x={x0}
              y={pad.top}
              width={Math.max(x1 - x0, 1)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHi(i)}
            />
          );
        })}
      </svg>

      {hi !== null && (
        <Tip
          xPct={(points[hi].x / w) * 100}
          yPct={(points[hi].y / h) * 100}
          title={labels[hi]}
          value={`${values[hi]}${valueSuffix}`}
        />
      )}
    </div>
  );
}

export function BarChart({
  items,
  height = 200,
  valueSuffix = "",
}: {
  items: { label: string; value: number }[];
  height?: number;
  valueSuffix?: string;
}) {
  const [hi, setHi] = useState<number | null>(null);
  const w = 640;
  const h = height;
  const pad = { top: 12, right: 12, bottom: 34, left: 40 };
  const max = Math.max(...items.map((i) => i.value), 1);
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;
  const slot = innerW / Math.max(items.length, 1);
  const barW = Math.min(70, slot * 0.5);

  const barX = (i: number) => pad.left + slot * i + (slot - barW) / 2;

  return (
    <div className="relative" onMouseLeave={() => setHi(null)}>
      <svg viewBox={`0 0 ${w} ${h}`} className="block w-full" role="img">
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1={pad.left}
              x2={w - pad.right}
              y1={pad.top + innerH * t}
              y2={pad.top + innerH * t}
              style={{ stroke: "var(--chart-grid)" }}
              strokeDasharray="3 4"
            />
            <text x={pad.left - 8} y={pad.top + innerH * t + 4} textAnchor="end" fontSize="10" style={{ fill: "var(--chart-label)" }}>
              {Math.round(max * (1 - t))}
            </text>
          </g>
        ))}
        {items.map((item, i) => {
          const barH = (item.value / max) * innerH;
          const x = barX(i);
          return (
            <g key={i} onMouseEnter={() => setHi(i)}>
              <rect
                x={x}
                y={pad.top + innerH - barH}
                width={barW}
                height={Math.max(barH, 2)}
                rx="4"
                fill={PURPLE}
                opacity={hi === null || hi === i ? 1 : 0.45}
                style={{ transition: "opacity 150ms" }}
              />
              {/* full-height hit target so thin bars are still easy to hover */}
              <rect x={x} y={pad.top} width={barW} height={innerH} fill="transparent" />
              <text x={x + barW / 2} y={h - 10} textAnchor="middle" fontSize="10" style={{ fill: "var(--chart-bar-label)" }}>
                {item.label.length > 14 ? `${item.label.slice(0, 13)}…` : item.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hi !== null && (
        <Tip
          xPct={((barX(hi) + barW / 2) / w) * 100}
          yPct={((pad.top + innerH - (items[hi].value / max) * innerH) / h) * 100}
          title={items[hi].label}
          value={`${items[hi].value}${valueSuffix}`}
        />
      )}
    </div>
  );
}

export function Donut({
  segments,
  size = 150,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const [hi, setHi] = useState<number | null>(null);
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;

  const active = hi !== null ? segments[hi] : null;

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      onMouseLeave={() => setHi(null)}
    >
      <circle cx="60" cy="60" r={r} fill="none" style={{ stroke: "var(--chart-track)" }} strokeWidth="18" />
      {segments.map((seg, i) => {
        const frac = seg.value / total;
        const dash = `${frac * c} ${c}`;
        const el = (
          <circle
            key={i}
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={hi === i ? 21 : 18}
            strokeDasharray={dash}
            strokeDashoffset={-offset * c}
            transform="rotate(-90 60 60)"
            opacity={hi === null || hi === i ? 1 : 0.5}
            style={{ transition: "stroke-width 120ms, opacity 120ms", cursor: "pointer" }}
            onMouseEnter={() => setHi(i)}
          />
        );
        offset += frac;
        return el;
      })}
      {active ? (
        <>
          <text x="60" y="57" textAnchor="middle" fontSize="15" fontWeight="700" style={{ fill: "var(--chart-text)" }}>
            {Math.round((active.value / total) * 100)}%
          </text>
          <text x="60" y="70" textAnchor="middle" fontSize="7" style={{ fill: "var(--chart-label)" }}>
            {active.value} calls
          </text>
        </>
      ) : null}
    </svg>
  );
}

export function Gauge({ percent }: { percent: number }) {
  const r = 46;
  const half = Math.PI * r;
  const frac = Math.min(Math.max(percent / 100, 0), 1);
  return (
    <svg viewBox="0 0 120 70" width="200" role="img">
      <path d="M 14 62 A 46 46 0 0 1 106 62" fill="none" style={{ stroke: "var(--chart-track)" }} strokeWidth="11" strokeLinecap="round" />
      <path
        d="M 14 62 A 46 46 0 0 1 106 62"
        fill="none"
        stroke={PURPLE}
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={`${frac * half} ${half}`}
      />
      <text x="60" y="52" textAnchor="middle" fontSize="19" fontWeight="700" style={{ fill: "var(--chart-text)" }}>
        {Math.round(percent * 10) / 10}%
      </text>
    </svg>
  );
}

export const CHART_COLORS = {
  purple: PURPLE,
  purpleSoft: PURPLE_SOFT,
  fuchsia: FUCHSIA,
  lilac: "#a78bfa",
};
