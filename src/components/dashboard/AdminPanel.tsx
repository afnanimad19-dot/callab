"use client";

// Platform-admin oversight: every tenant clinic, their plan, credit usage and
// content counts, with the ability to change any tenant's plan. Read-only on
// personal data beyond what's needed to run the business.

import { useEffect, useMemo, useState } from "react";
import { Search, Download, Users, Wallet, PhoneCall, CalendarCheck } from "lucide-react";
import { toast, toastError } from "@/components/Toast";

type Tenant = {
  id: string; name: string; email: string; company: string; createdAt: string;
  emailVerified: boolean; plan: string; planName: string; planPriceAED: number;
  minutesUsed: number; minutesTotal: number; minutesPct: number;
  agents: number; contacts: number; appointments: number; calls: number; members: number;
};
type Tier = { key: string; name: string; priceAED: number };
type Totals = { tenants: number; mrrAED: number; minutesUsed: number; calls: number; appointments: number };

function csv(rows: Tenant[]) {
  const head = "company,name,email,plan,price_aed,minutes_used,minutes_total,agents,contacts,appointments,calls,members,created";
  const lines = rows.map((r) =>
    [r.company, r.name, r.email, r.planName, r.planPriceAED, r.minutesUsed, r.minutesTotal, r.agents, r.contacts, r.appointments, r.calls, r.members, r.createdAt]
      .map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")
  );
  const blob = new Blob([[head, ...lines].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tenants-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

export default function AdminPanel() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/admin/users");
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) { toastError(data.error ?? "Could not load tenants."); return; }
    setTenants(data.tenants ?? []);
    setTiers(data.tiers ?? []);
    setTotals(data.totals ?? null);
  }
  useEffect(() => { load(); }, []);

  async function changePlan(userId: string, tier: string) {
    setTenants((t) => t.map((x) => (x.id === userId ? { ...x, plan: tier, planName: tiers.find((z) => z.key === tier)?.name ?? tier } : x)));
    const res = await fetch("/api/admin/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, tier }),
    });
    if (res.ok) { toast("Plan updated."); load(); }
    else { toastError("Could not change the plan."); load(); }
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tenants
      .filter((t) => planFilter === "all" || t.plan === planFilter)
      .filter((t) => !q || `${t.company} ${t.name} ${t.email}`.toLowerCase().includes(q));
  }, [tenants, query, planFilter]);

  const kpis = totals && [
    { label: "Clinics", value: totals.tenants.toLocaleString(), icon: Users },
    { label: "Monthly recurring", value: `${totals.mrrAED.toLocaleString()} AED`, icon: Wallet },
    { label: "Calls (all-time)", value: totals.calls.toLocaleString(), icon: PhoneCall },
    { label: "Appointments", value: totals.appointments.toLocaleString(), icon: CalendarCheck },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
          <p className="mt-0.5 text-sm text-ink-400">Every clinic on VoiceLine AI — plans, usage and activity.</p>
        </div>
        <button onClick={() => csv(rows)} className="btn-secondary flex items-center gap-1.5 !text-sm">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {kpis && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="card flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-100 text-[#301C3F]"><k.icon className="h-5 w-5" /></span>
              <div>
                <div className="text-xl font-bold tabular-nums">{k.value}</div>
                <div className="text-xs text-ink-400">{k.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500"><Search className="h-4 w-4" /></span>
          <input className="field !py-2.5 !pl-9" placeholder="Search clinic, name or email…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="field !w-auto !py-2.5" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
          <option value="all">All plans</option>
          {tiers.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
        </select>
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="px-4 py-3 font-medium">Clinic</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Minutes</th>
              <th className="px-4 py-3 font-medium">Agents</th>
              <th className="px-4 py-3 font-medium">Contacts</th>
              <th className="px-4 py-3 font-medium">Appts</th>
              <th className="px-4 py-3 font-medium">Calls</th>
              <th className="px-4 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700/70">
            {loading && <tr><td colSpan={8} className="px-4 py-10 text-center text-ink-400">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-ink-400">No clinics yet.</td></tr>}
            {rows.map((t) => (
              <tr key={t.id} className="transition hover:bg-ink-800/60">
                <td className="px-4 py-3">
                  <div className="font-medium">{t.company || "—"}</div>
                  <div className="text-xs text-ink-400">{t.name} · {t.email}{!t.emailVerified && <span className="ml-1 text-signal-amber">(unverified)</span>}</div>
                </td>
                <td className="px-4 py-3">
                  <select value={t.plan} onChange={(e) => changePlan(t.id, e.target.value)}
                    className="field !w-auto !py-1.5 !text-xs">
                    {tiers.map((z) => <option key={z.key} value={z.key}>{z.name}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="tabular-nums">{t.minutesUsed.toLocaleString()} / {t.minutesTotal.toLocaleString()}</div>
                  <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-ink-800">
                    <div className={`h-full rounded-full ${t.minutesPct >= 90 ? "bg-signal-red" : t.minutesPct >= 70 ? "bg-signal-amber" : "grad-bg"}`} style={{ width: `${Math.max(3, t.minutesPct)}%` }} />
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums">{t.agents}</td>
                <td className="px-4 py-3 tabular-nums">{t.contacts}</td>
                <td className="px-4 py-3 tabular-nums">{t.appointments}</td>
                <td className="px-4 py-3 tabular-nums">{t.calls}</td>
                <td className="px-4 py-3 text-ink-400">{new Date(t.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
