import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  listAgents, listCalls, listAppointments, listContacts, listConversations,
  listKnowledgeBases, listIntegrations,
} from "@/lib/db";
import ReportsPanel from "@/components/dashboard/ReportsPanel";

export const metadata = { title: "Reports — VoiceLine AI" };

const DAY = 24 * 60 * 60 * 1000;
const key = (d: Date) => d.toISOString().slice(0, 10);

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const uid = session.userId;

  const [agents, calls, appts, contacts, convos, kbs, integrations] = await Promise.all([
    listAgents(uid), listCalls(uid), listAppointments(uid), listContacts(uid),
    listConversations(uid), listKnowledgeBases(uid), listIntegrations(uid),
  ]);

  // --- Date range (?range=7|30|90|all or ?from&to custom) -------------------
  const sp = await searchParams;
  const range = sp.range ?? "30";
  const now = new Date();
  let toKey = key(now);
  let fromKey: string;
  if (sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)) {
    fromKey = sp.from;
    if (sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)) toKey = sp.to;
  } else if (range === "all") {
    const earliest = [
      ...calls.map((c) => c.startedAt),
      ...appts.map((a) => a.createdAt),
      ...contacts.map((c) => c.createdAt),
    ].sort()[0];
    fromKey = earliest ? earliest.slice(0, 10) : key(new Date(now.getTime() - 29 * DAY));
  } else {
    const days = range === "7" ? 7 : range === "90" ? 90 : 30;
    fromKey = key(new Date(now.getTime() - (days - 1) * DAY));
  }
  if (fromKey > toKey) [fromKey, toKey] = [toKey, fromKey];

  const inRange = (iso: string) => {
    const k = iso.slice(0, 10);
    return k >= fromKey && k <= toKey;
  };

  const rCalls = calls.filter((c) => inRange(c.startedAt));
  const rAppts = appts.filter((a) => inRange(a.createdAt));
  const rContacts = contacts.filter((c) => inRange(c.createdAt));
  const rConvos = convos.filter((c) => inRange(c.createdAt));

  // Day buckets across the range (capped at 120 points so "All time" stays sane).
  const spanDays = Math.min(120, Math.max(1, Math.round((Date.parse(toKey) - Date.parse(fromKey)) / DAY) + 1));
  const start = new Date(Date.parse(toKey) - (spanDays - 1) * DAY);
  const keys: string[] = [];
  const labels: string[] = [];
  for (let i = 0; i < spanDays; i++) {
    const d = new Date(start.getTime() + i * DAY);
    keys.push(key(d));
    labels.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
  }
  const callsPerDay = keys.map((k) => rCalls.filter((c) => c.startedAt.slice(0, 10) === k).length);
  const minutesPerDay = keys.map((k) =>
    Math.round(rCalls.filter((c) => c.startedAt.slice(0, 10) === k).reduce((s, c) => s + (c.durationSec || 0), 0) / 60)
  );

  const countMap = (arr: string[]) => {
    const m: Record<string, number> = {};
    for (const v of arr) m[v] = (m[v] ?? 0) + 1;
    return m;
  };

  const perAgentMap = new Map<string, number>();
  for (const c of rCalls) perAgentMap.set(c.agentName || "Unknown", (perAgentMap.get(c.agentName || "Unknown") ?? 0) + 1);
  const perAgent = [...perAgentMap.entries()].map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value).slice(0, 8);

  const data = {
    kpis: {
      calls: rCalls.length,
      minutes: Math.round(rCalls.reduce((s, c) => s + (c.durationSec || 0), 0) / 60),
      appointments: rAppts.length,
      contacts: rContacts.length,
      agents: agents.length,
      conversations: rConvos.length,
      knowledgeBases: kbs.length,
      integrations: integrations.length,
    },
    trend: { labels, callsPerDay, minutesPerDay },
    outcomes: countMap(rCalls.map((c) => c.outcome)),
    apptSource: countMap(rAppts.map((a) => a.source || "manual")),
    apptStatus: countMap(rAppts.map((a) => a.status)),
    channels: countMap(rConvos.map((c) => c.channel)),
    byLanguage: countMap(agents.map((a) => a.language || "Unknown")),
    sentiments: countMap(rCalls.map((c) => c.sentiment)),
    perAgent,
    exports: {
      calls: rCalls.map((c) => ({ date: c.startedAt, agent: c.agentName, caller: c.callerNumber, seconds: c.durationSec, outcome: c.outcome, sentiment: c.sentiment })),
      appointments: rAppts.map((a) => ({ patient: a.patientName, phone: a.phone ?? "", email: a.email ?? "", doctor: a.doctor ?? "", service: a.service ?? "", when: a.startsAt, status: a.status, source: a.source ?? "" })),
      contacts: rContacts.map((c) => ({ name: c.name, phone: c.phone, email: c.metadata?.email ?? "", source: c.source ?? "", tag: c.tag, created: c.createdAt })),
    },
  };

  return <ReportsPanel data={data} range={sp.from ? "custom" : range} from={fromKey} to={toKey} />;
}
