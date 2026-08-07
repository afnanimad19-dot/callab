import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findAgent, insertCalls, newId, Call, TranscriptTurn } from "@/lib/db";

// Log a Test Agent session into Call Logs. Marked isTest so the table can
// badge it, with the real date/time and transcript of the test.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const agentId = String(body?.agentId ?? "");
  const agent = await findAgent(session.userId, agentId);
  if (!agent) return NextResponse.json({ error: "Agent not found." }, { status: 404 });

  const startedAt =
    typeof body?.startedAt === "string" && !Number.isNaN(Date.parse(body.startedAt))
      ? body.startedAt
      : new Date().toISOString();
  const durationSec = Math.max(0, Math.round(Number(body?.durationSec) || 0));
  const mode = body?.mode === "voice" ? "voice" : "text";

  const transcript: TranscriptTurn[] = Array.isArray(body?.transcript)
    ? body.transcript
        .filter((t: unknown) => t && typeof t === "object")
        .slice(0, 500)
        .map((t: { speaker?: string; text?: string; at?: number }) => ({
          speaker: t.speaker === "agent" ? "agent" : "caller",
          text: String(t.text ?? "").slice(0, 4000),
          at: Math.max(0, Math.round(Number(t.at) || 0)),
        }))
    : [];

  const call: Call = {
    id: newId("call"),
    userId: session.userId,
    agentId: agent.id,
    agentName: agent.name,
    callerNumber: mode === "voice" ? "Test (voice)" : "Test (text)",
    direction: "outbound",
    startedAt,
    durationSec,
    outcome: "resolved",
    endReason: "test call",
    sentiment: "neutral",
    confidence: 1,
    summary: `Test ${mode} session with ${agent.name} run by ${session.name}.`,
    transcript,
    isTest: true,
  };
  await insertCalls([call]);
  return NextResponse.json({ ok: true, callId: call.id }, { status: 201 });
}
