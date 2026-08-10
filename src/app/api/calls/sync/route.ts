import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listAgents, listCalls, insertCalls, Call } from "@/lib/db";
import { getCallDetails, listRecentVapiCalls, vapiConfigured } from "@/lib/vapi";

// Backfill Call Logs from Vapi. Pulls the recent calls Vapi has on record for
// THIS workspace's agents and inserts any that aren't logged yet — recovering
// calls whose end-of-call webhook was missed (e.g. an inbound phone call made
// before the assistant carried a server URL). Idempotent: a call already in
// the log is skipped.
function outcomeFor(reason?: string): Call["outcome"] {
  const r = (reason ?? "").toLowerCase();
  if (r.includes("transfer") || r.includes("forward")) return "escalated";
  if (r.includes("voicemail")) return "voicemail";
  if (r.includes("no-answer") || r.includes("busy")) return "callback_scheduled";
  return "resolved";
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!vapiConfigured()) {
    return NextResponse.json({ error: "The voice pipeline isn't connected." }, { status: 400 });
  }

  const [agents, existing, recent] = await Promise.all([
    listAgents(session.userId),
    listCalls(session.userId),
    listRecentVapiCalls(),
  ]);
  const byAssistant = new Map(
    agents.filter((a) => a.vapiAssistantId).map((a) => [a.vapiAssistantId as string, a])
  );
  const known = new Set(existing.map((c) => c.vapiCallId).filter(Boolean));

  // Only ours, only ended, only not-already-logged.
  const missing = recent.filter(
    (c) => c.assistantId && byAssistant.has(c.assistantId) && !known.has(c.id)
  );

  const rows: Call[] = [];
  for (const c of missing.slice(0, 50)) {
    const agent = byAssistant.get(c.assistantId as string)!;
    const details = await getCallDetails(c.id);
    const durationSec =
      details?.durationSec ||
      (c.startedAt && c.endedAt
        ? Math.max(0, Math.round((Date.parse(c.endedAt) - Date.parse(c.startedAt)) / 1000))
        : 0);
    rows.push({
      id: `call_${c.id.replace(/-/g, "").slice(0, 20)}`,
      userId: session.userId,
      agentId: agent.id,
      agentName: agent.name,
      callerNumber: c.customerNumber ?? "Unknown",
      direction: c.direction,
      startedAt: c.startedAt ?? new Date().toISOString(),
      durationSec,
      outcome: outcomeFor(c.endedReason),
      endReason: c.endedReason ?? "completed",
      sentiment: "neutral",
      confidence: 0.8,
      summary: c.summary ?? "Call completed.",
      transcript: details?.transcript ?? [],
      recordingUrl: details?.recordingUrl ?? undefined,
      vapiCallId: c.id,
    });
  }

  if (rows.length) await insertCalls(rows);
  return NextResponse.json({ imported: rows.length, scanned: recent.length });
}
