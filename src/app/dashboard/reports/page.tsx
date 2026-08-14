import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  listAgents, listCalls, listAppointments, listContacts, listConversations,
  listKnowledgeBases, listIntegrations,
} from "@/lib/db";
import ReportsPanel from "@/components/dashboard/ReportsPanel";

export const metadata = { title: "Reports — VoiceLine AI" };

function lastNDays(n: number) {
  // Build day keys + short labels for the last n days (local calendar).
  const keys: string[] = [];
  const labels: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    keys.push(d.toISOString().slice(0, 10));
    labels.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
  }
  return { keys, labels };
}

export default async function ReportsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const uid = session.userId;

  const [agents, calls, appts, contacts, convos, kbs, integrations] = await Promise.all([
    listAgents(uid), listCalls(uid), listAppointments(uid), listContacts(uid),
    listConversations(uid), listKnowledgeBases(uid), listIntegrations(uid),
  ]);

  const { keys, labels } = lastNDays(30);
  const callsPerDay = keys.map((k) => calls.filter((c) => c.startedAt.slice(0, 10) === k).length);
  const minutesPerDay = keys.map((k) =>
    Math.round(calls.filter((c) => c.startedAt.slice(0, 10) === k).reduce((s, c) => s + (c.durationSec || 0), 0) / 60)
  );

  const countMap = (arr: string[]) => {
    const m: Record<string, number> = {};
    for (const v of arr) m[v] = (m[v] ?? 0) + 1;
    return m;
  };

  const outcomes = countMap(calls.map((c) => c.outcome));
  const apptSource = countMap(appts.map((a) => a.source || "manual"));
  const apptStatus = countMap(appts.map((a) => a.status));
  const channels = countMap(convos.map((c) => c.channel));
  const byLanguage = countMap(agents.map((a) => a.language || "Unknown"));
  const sentiments = countMap(calls.map((c) => c.sentiment));

  const perAgentMap = new Map<string, number>();
  for (const c of calls) perAgentMap.set(c.agentName || "Unknown", (perAgentMap.get(c.agentName || "Unknown") ?? 0) + 1);
  const perAgent = [...perAgentMap.entries()].map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value).slice(0, 8);

  const totalMinutes = Math.round(calls.reduce((s, c) => s + (c.durationSec || 0), 0) / 60);

  const data = {
    kpis: {
      calls: calls.length,
      minutes: totalMinutes,
      appointments: appts.length,
      contacts: contacts.length,
      agents: agents.length,
      conversations: convos.length,
      knowledgeBases: kbs.length,
      integrations: integrations.length,
    },
    trend: { labels, callsPerDay, minutesPerDay },
    outcomes, apptSource, apptStatus, channels, byLanguage, sentiments, perAgent,
    // Trimmed rows for CSV export.
    exports: {
      calls: calls.map((c) => ({ date: c.startedAt, agent: c.agentName, caller: c.callerNumber, seconds: c.durationSec, outcome: c.outcome, sentiment: c.sentiment })),
      appointments: appts.map((a) => ({ patient: a.patientName, phone: a.phone ?? "", email: a.email ?? "", doctor: a.doctor ?? "", service: a.service ?? "", when: a.startsAt, status: a.status, source: a.source ?? "" })),
      contacts: contacts.map((c) => ({ name: c.name, phone: c.phone, email: c.metadata?.email ?? "", source: c.source ?? "", tag: c.tag, created: c.createdAt })),
    },
  };

  return <ReportsPanel data={data} />;
}
