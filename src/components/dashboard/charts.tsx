// Lightweight SVG charts (no chart library): smooth area lines, bars,
// donut, and a semicircle gauge — themed for the dark UI with the
// violet→fuchsia gradient accent.

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

export function AreaChart({
  values,
  labels,
  height = 190,
}: {
  values: number[];
  labels: string[];
  height?: number;
}) {
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
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img">
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
            stroke="#24242e"
            strokeDasharray="3 4"
          />
          <text
            x={pad.left - 8}
            y={pad.top + innerH * t + 4}
            textAnchor="end"
            fontSize="10"
            fill="#8b8b9a"
          >
            {Math.round(max * (1 - t) * 10) / 10}
          </text>
        </g>
      ))}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={PURPLE} strokeWidth="2.5" strokeLinecap="round" />
      {labels.map((label, i) => (
        <text
          key={i}
          x={pad.left + (labels.length === 1 ? innerW / 2 : (i / (labels.length - 1)) * innerW)}
          y={h - 8}
          textAnchor="middle"
          fontSize="10"
          fill="#8b8b9a"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

export function BarChart({
  items,
  height = 200,
}: {
  items: { label: string; value: number }[];
  height?: number;
}) {
  const w = 640;
  const h = height;
  const pad = { top: 12, right: 12, bottom: 34, left: 40 };
  const max = Math.max(...items.map((i) => i.value), 1);
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;
  const slot = innerW / Math.max(items.length, 1);
  const barW = Math.min(70, slot * 0.5);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img">
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line
            x1={pad.left}
            x2={w - pad.right}
            y1={pad.top + innerH * t}
            y2={pad.top + innerH * t}
            stroke="#24242e"
            strokeDasharray="3 4"
          />
          <text
            x={pad.left - 8}
            y={pad.top + innerH * t + 4}
            textAnchor="end"
            fontSize="10"
            fill="#8b8b9a"
          >
            {Math.round(max * (1 - t))}
          </text>
        </g>
      ))}
      {items.map((item, i) => {
        const x = pad.left + slot * i + (slot - barW) / 2;
        const barH = (item.value / max) * innerH;
        return (
          <g key={i}>
            <rect
              x={x}
              y={pad.top + innerH - barH}
              width={barW}
              height={Math.max(barH, 2)}
              rx="4"
              fill={PURPLE}
            />
            <text
              x={x + barW / 2}
              y={h - 10}
              textAnchor="middle"
              fontSize="10"
              fill="#b4b4c0"
            >
              {item.label.length > 14 ? `${item.label.slice(0, 13)}…` : item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function Donut({
  segments,
  size = 150,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img">
      <circle cx="60" cy="60" r={r} fill="none" stroke="#191920" strokeWidth="18" />
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
            strokeWidth="18"
            strokeDasharray={dash}
            strokeDashoffset={-offset * c}
            transform="rotate(-90 60 60)"
          />
        );
        offset += frac;
        return el;
      })}
    </svg>
  );
}

export function Gauge({ percent }: { percent: number }) {
  const r = 46;
  const half = Math.PI * r;
  const frac = Math.min(Math.max(percent / 100, 0), 1);
  return (
    <svg viewBox="0 0 120 70" width="200" role="img">
      <path
        d="M 14 62 A 46 46 0 0 1 106 62"
        fill="none"
        stroke="#191920"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        d="M 14 62 A 46 46 0 0 1 106 62"
        fill="none"
        stroke={PURPLE}
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={`${frac * half} ${half}`}
      />
      <text x="60" y="52" textAnchor="middle" fontSize="19" fontWeight="700" fill="#f5f5f8">
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
