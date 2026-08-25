import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listAgents, listCalls, listCampaigns, Call } from "@/lib/db";
import {
  AreaChart,
  BarChart,
  CHART_COLORS,
  Donut,
  Gauge,
} from "@/components/dashboard/charts";
import DateRangeSelect from "@/components/dashboard/DateRangeSelect";

function fmtDuration(totalSec: number) {
  const whole = Math.round(totalSec); // avoid float noise like 1.70199999s
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function lastNDays(n: number, endOffset = 0): string[] {
  const days: string[] = [];
  for (let i = n - 1 + endOffset; i >= endOffset; i--) {
    days.push(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10));
  }
  return days;
}

// Resolve the ?range= param into the day window shown on every chart.
function daysForRange(range: string, calls: Call[]): string[] {
  switch (range) {
    case "today":
      return lastNDays(1);
    case "yesterday":
      return lastNDays(1, 1);
    case "30d":
      return lastNDays(30);
    case "90d":
      return lastNDays(90);
    case "all": {
      const earliest = calls.length
        ? calls.reduce((min, c) => (c.startedAt < min ? c.startedAt : min), calls[0].startedAt)
        : new Date().toISOString();
      const spanDays = Math.ceil((Date.now() - Date.parse(earliest)) / 86400_000) + 1;
      return lastNDays(Math.min(Math.max(spanDays, 1), 90));
    }
    default:
      return lastNDays(7);
  }
}

function dayLabel(key: string) {
  const [, m, d] = key.split("-");
  return `${m}/${d}`;
}

const SUCCESS_OUTCOMES = new Set(["resolved", "callback_scheduled"]);
const isSuccess = (c: Call) => SUCCESS_OUTCOMES.has(c.outcome);

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { range = "7d" } = await searchParams;

  const [agents, allCalls, campaigns] = await Promise.all([
    listAgents(session.userId),
    listCalls(session.userId),
    listCampaigns(session.userId),
  ]);

  const days = daysForRange(range, allCalls);
  const daySet = new Set(days);
  const calls = allCalls.filter((c) => daySet.has(dayKey(c.startedAt)));
  const byDay = new Map(days.map((d) => [d, [] as Call[]]));
  for (const c of calls) {
    byDay.get(dayKey(c.startedAt))?.push(c);
  }

  const totalDuration = calls.reduce((s, c) => s + c.durationSec, 0);
  const successful = calls.filter(isSuccess).length;
  const failed = calls.length - successful;
  const successRate = calls.length ? (successful / calls.length) * 100 : 0;
  const avgDuration = calls.length ? Math.round(totalDuration / calls.length) : 0;
  const activeCampaigns = campaigns.filter((c) => c.status === "running").length;

  const callsPerDay = days.map((d) => byDay.get(d)!.length);
  const durationPerDay = days.map((d) =>
    byDay.get(d)!.reduce((s, c) => s + c.durationSec, 0)
  );
  const successPerDay = days.map((d) => {
    const dc = byDay.get(d)!;
    return dc.length ? Math.round((dc.filter(isSuccess).length / dc.length) * 100) : 0;
  });
  const labels = days.map(dayLabel);

  const perAgent = agents.map((a) => {
    const ac = calls.filter((c) => c.agentId === a.id);
    return {
      label: a.name,
      value: ac.length
        ? Math.round(ac.reduce((s, c) => s + c.durationSec, 0) / ac.length)
        : 0,
    };
  });

  const perCampaign = campaigns.map((cmp) => {
    const cc = calls.filter((c) => c.campaignId === cmp.id);
    return {
      label: cmp.name,
      value: cc.length
        ? Math.round(cc.reduce((s, c) => s + c.durationSec, 0) / cc.length)
        : 0,
    };
  });

  const reasonCounts = new Map<string, number>();
  for (const c of calls) {
    reasonCounts.set(c.endReason, (reasonCounts.get(c.endReason) ?? 0) + 1);
  }
  const reasonPalette = ["#301C3F", CHART_COLORS.purple, CHART_COLORS.fuchsia, CHART_COLORS.lilac, "#64748B"];
  const reasons = [...reasonCounts.entries()].map(([label, value], i) => ({
    label,
    value,
    color: reasonPalette[i % reasonPalette.length],
  }));

  const statCards = [
    { label: "Total Calls", value: String(calls.length) },
    { label: "Total Call Duration", value: fmtDuration(totalDuration) },
    { label: "Active AI Agents", value: String(agents.filter((a) => a.status === "active").length) },
    { label: "Active Campaigns", value: String(activeCampaigns) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Home Dashboard</h1>
          <p className="mt-1 text-sm text-ink-400">
            Overview of your call analytics, agents, campaigns and performance.
          </p>
        </div>
        <DateRangeSelect current={range} />
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="card">
            <p className="text-sm font-medium text-ink-300">{s.label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Success rate + calls over time */}
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-sm font-semibold">Overall Success Rate</h2>
            <div className="mt-3 flex flex-col items-center">
              <Gauge percent={successRate} />
              <p className="-mt-1 text-xs text-ink-400">Success Rate</p>
              <div className="mt-3 flex gap-6 text-xs text-ink-400">
                <span>
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent-500" />
                  Successful <span className="font-semibold text-ink-100">{successful}</span>
                </span>
                <span>
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent-300" />
                  Total Calls <span className="font-semibold text-ink-100">{calls.length}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="card">
            <h2 className="text-sm font-semibold">Call Summary</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <dd className="text-2xl font-bold">{calls.length}</dd>
                <dt className="text-xs text-ink-400">Total Calls</dt>
              </div>
              <div>
                <dd className="text-2xl font-bold">{fmtDuration(totalDuration)}</dd>
                <dt className="text-xs text-ink-400">Total Talk Time</dt>
              </div>
              <div>
                <dd className="text-2xl font-bold">{fmtDuration(avgDuration)}</dd>
                <dt className="text-xs text-ink-400">Avg Call Duration</dt>
              </div>
            </dl>
          </div>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold">Calls Over Time</h2>
          <p className="text-xs text-ink-400">Call volume trends</p>
          <div className="mt-3 grid grid-cols-3 gap-4 border-b border-ink-700 pb-3">
            <div>
              <p className="text-xs text-ink-400">Total Calls</p>
              <p className="text-xl font-bold">{calls.length}</p>
            </div>
            <div>
              <p className="text-xs text-ink-400">Failed</p>
              <p className="text-xl font-bold">{failed}</p>
            </div>
            <div>
              <p className="text-xs text-ink-400">Successful</p>
              <p className="text-xl font-bold">{successful}</p>
            </div>
          </div>
          <div className="mt-4">
            <AreaChart values={callsPerDay} labels={labels} height={210} />
          </div>
        </div>
      </div>

      {/* Duration + success rate over time */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-sm font-semibold">Call Duration Over Time</h2>
          <p className="text-xs text-ink-400">Total talk time per day (seconds)</p>
          <div className="mt-4">
            <AreaChart values={durationPerDay} labels={labels} valueSuffix="s" />
          </div>
        </div>
        <div className="card">
          <h2 className="text-sm font-semibold">Success Rate Over Time</h2>
          <p className="text-xs text-ink-400">Call success percentage</p>
          <div className="mt-4">
            <AreaChart values={successPerDay} labels={labels} valueSuffix="%" />
          </div>
        </div>
      </div>

      {/* Performance by agent / campaign */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-sm font-semibold">Performance by AI Agent</h2>
          <p className="text-xs text-ink-400">Avg duration (sec) by agent</p>
          <div className="mt-4">
            <BarChart items={perAgent} valueSuffix="s" />
          </div>
        </div>
        <div className="card">
          <h2 className="text-sm font-semibold">Performance by Campaign</h2>
          <p className="text-xs text-ink-400">Avg duration (sec) by campaign</p>
          <div className="mt-4">
            {perCampaign.length ? (
              <BarChart items={perCampaign} valueSuffix="s" />
            ) : (
              <p className="py-10 text-center text-sm text-ink-400">No campaigns yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* End call reasons + concurrent calls */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-sm font-semibold">End Call Reasons</h2>
          <p className="text-xs text-ink-400">Why calls end</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-6">
            <Donut segments={reasons} />
            <ul className="space-y-2 text-xs">
              {reasons.map((r) => (
                <li key={r.label} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                  <span className="text-ink-200">{r.label}</span>
                  <span className="text-ink-400">
                    {r.value} · {Math.round((r.value / Math.max(calls.length, 1)) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="card">
          <h2 className="text-sm font-semibold">Concurrent Calls Over Time</h2>
          <p className="text-xs text-ink-400">Peak simultaneous active calls per day</p>
          <div className="mt-4">
            <BarChart
              items={days.slice(-4).map((d) => {
                // Real peak concurrency: sweep the day's call start/end events.
                const dayCalls = byDay.get(d)!;
                const events: [number, number][] = [];
                for (const c of dayCalls) {
                  const start = Date.parse(c.startedAt);
                  events.push([start, 1], [start + (c.durationSec || 0) * 1000, -1]);
                }
                events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
                let cur = 0, peak = 0;
                for (const [, delta] of events) { cur += delta; peak = Math.max(peak, cur); }
                return { label: dayLabel(d), value: peak };
              })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
