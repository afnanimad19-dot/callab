import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteAgent, findAgent, updateAgent, Agent } from "@/lib/db";
import { sanitizeAdvanced, sanitizeOutcomes } from "@/lib/agent-sanitize";
import { syncAgentToVapi } from "@/lib/vapi";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const agent = await findAgent(session.userId, id);
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ agent });
}

const STRING_FIELDS = [
  "name",
  "role",
  "voice",
  "language",
  "greeting",
  "systemPrompt",
  "phoneNumber",
  "backgroundAudio",
  "identity",
  "tasks",
  "guardrails",
] as const;

export async function PATCH(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await findAgent(session.userId, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const patch: Partial<Agent> = {};

  for (const key of STRING_FIELDS) {
    if (typeof body?.[key] === "string") patch[key] = body[key];
  }
  if (["active", "paused", "draft"].includes(body?.status)) {
    patch.status = body.status;
  }
  if (["agent", "caller"].includes(body?.whoSpeaksFirst)) {
    patch.whoSpeaksFirst = body.whoSpeaksFirst;
  }
  if (body?.outcomes !== undefined) {
    patch.outcomes = sanitizeOutcomes(body.outcomes);
  }
  if (body?.advanced !== undefined) {
    patch.advanced = sanitizeAdvanced(body.advanced);
  }
  // Publishing bumps the version so the badge reflects revisions.
  patch.version = (existing.version ?? 1) + 1;

  const agent = await updateAgent(session.userId, id, patch);
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await syncAgentToVapi(agent);
  } catch (e) {
    console.error("Vapi sync failed:", e);
  }

  return NextResponse.json({ agent });
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const removed = await deleteAgent(session.userId, id);
  if (!removed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
