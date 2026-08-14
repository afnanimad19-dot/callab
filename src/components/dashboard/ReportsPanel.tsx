"use client";

// Reports: a detailed, chart-led view of everything the workspace does —
// calls, minutes, appointments, channels, languages, agents — with CSV export
// for each dataset.

import { Download, PhoneCall, Clock, CalendarCheck, Users, Bot, MessageCircle, BookOpen, Plug } from "lucide-react";
import { AreaChart, BarChart, Donut } from "./charts";

const DONUT_COLORS = ["#8b5cf6", "#d946ef", "#22c55e", "#f59e0b", "#3b82f6", "#ef4444", "#14b8a6", "#a855f7"];

type Data = {
  kpis: Record<string, number>;
  trend: { labels: string[]; callsPerDay: number[]; minutesPerDay: number[] };
  outcomes: Record<string, number>;
  apptSource: Record<string, number>;
  apptStatus: Record<string, number>;
  channels: Record<string, number>;
  byLanguage: Record<string, number>;
  sentiments: Record<string, number>;
  perAgent: { label: string; value: number }[];
  exports: { calls: Record<string, unknown>[]; appointments: Record<string, unknown>[]; contacts: Record<string, unknown>[] };
};

function toDonut(m: Record<string, number>) {
  return Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({ label: label.replaceAll("_", " "), value, color: DONUT_COLORS[i % DONUT_COLORS.length] }));
}

function exportCsv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const body = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

function LegendDonut({ title, map }: { title: string; map: Record<string, number> }) {
  const segs = toDonut(map);
  const total = segs.reduce((s, x) => s + x.value, 0);
  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {total === 0 ? (
        <p className="py-8 text-center text-sm text-ink-400">No data yet.</p>
      ) : (
        <div className="flex items-center gap-4">
          <Donut segments={segs} size={130} />
          <ul className="flex-1 space-y-1.5 text-sm">
            {segs.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 capitalize">
                  <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} /> {s.label}
                </span>
                <span className="tabular-nums text-ink-300">{s.value} · {Math.round((s.value / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ReportsPanel({ data }: { data: Data }) {
  const k = data.kpis;
  const kpis = [
    { label: "Total calls", value: k.calls, icon: PhoneCall },
    { label: "Voice minutes", value: k.minutes, icon: Clock },
    { label: "Appointments", value: k.appointments, icon: CalendarCheck },
    { label: "Contacts", value: k.contacts, icon: Users },
    { label: "AI agents", value: k.agents, icon: Bot },
    { label: "Conversations", value: k.conversations, icon: MessageCircle },
    { label: "Knowledge bases", value: k.knowledgeBases, icon: BookOpen },
    { label: "Integrations", value: k.integrations, icon: Plug },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="mt-0.5 text-sm text-ink-400">Everything your workspace does, in charts — with CSV export.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => exportCsv("calls", data.exports.calls)} className="btn-secondary flex items-center gap-1.5 !text-sm"><Download className="h-4 w-4" /> Calls</button>
          <button onClick={() => exportCsv("appointments", data.exports.appointments)} className="btn-secondary flex items-center gap-1.5 !text-sm"><Download className="h-4 w-4" /> Appointments</button>
          <button onClick={() => exportCsv("contacts", data.exports.contacts)} className="btn-secondary flex items-center gap-1.5 !text-sm"><Download className="h-4 w-4" /> Contacts</button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((x) => (
          <div key={x.label} className="card flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-100 text-[#301C3F]"><x.icon className="h-5 w-5" /></span>
            <div>
              <div className="text-xl font-bold tabular-nums">{x.value.toLocaleString()}</div>
              <div className="text-xs text-ink-400">{x.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Trends */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold">Calls · last 30 days</h3>
          <AreaChart values={data.trend.callsPerDay} labels={data.trend.labels} height={200} />
        </div>
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold">Voice minutes · last 30 days</h3>
          <AreaChart values={data.trend.minutesPerDay} labels={data.trend.labels} height={200} valueSuffix="m" />
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid gap-4 lg:grid-cols-3">
        <LegendDonut title="Call outcomes" map={data.outcomes} />
        <LegendDonut title="Appointments by channel" map={data.apptSource} />
        <LegendDonut title="Inbox by channel" map={data.channels} />
        <LegendDonut title="Appointment status" map={data.apptStatus} />
        <LegendDonut title="Agents by language" map={data.byLanguage} />
        <LegendDonut title="Call sentiment" map={data.sentiments} />
      </div>

      {/* Per-agent */}
      <div className="card">
        <h3 className="mb-3 text-sm font-semibold">Calls per agent</h3>
        {data.perAgent.length ? (
          <BarChart items={data.perAgent} height={220} />
        ) : (
          <p className="py-8 text-center text-sm text-ink-400">No calls yet.</p>
        )}
      </div>
    </div>
  );
}
