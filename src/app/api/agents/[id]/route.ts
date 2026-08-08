import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteAgent, findAgent, updateAgent, Agent, AgentRevision } from "@/lib/db";
import { sanitizeAdvanced, sanitizeOutcomes, sanitizeTools } from "@/lib/agent-sanitize";
import { syncAgentToVapi } from "@/lib/vapi";
import { buildKnowledgeText } from "@/lib/knowledge";

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
  if (body?.tools !== undefined) {
    patch.tools = sanitizeTools(body.tools);
  }
  if (["private", "public"].includes(body?.visibility)) {
    patch.visibility = body.visibility;
  }
  if (typeof body?.voiceId === "string") {
    patch.voiceId = body.voiceId.slice(0, 60);
  }
  if (body?.knowledgeBaseIds !== undefined) {
    patch.knowledgeBaseIds = Array.isArray(body.knowledgeBaseIds)
      ? body.knowledgeBaseIds.map(String).slice(0, 20)
      : [];
  }
  // A visibility-only change (Share dialog toggle) isn't a new revision.
  const visibilityOnly =
    Object.keys(patch).length === 1 && patch.visibility !== undefined;
  if (visibilityOnly) {
    const agent = await updateAgent(session.userId, id, patch);
    if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ agent });
  }

  // Publishing bumps the version so the badge reflects revisions.
  patch.version = (existing.version ?? 1) + 1;

  // Snapshot the outgoing version so the editor can restore it later.
  const snapshot: AgentRevision = {
    version: existing.version ?? 1,
    savedAt: new Date().toISOString(),
    snapshot: {
      name: existing.name,
      language: existing.language,
      voice: existing.voice,
      backgroundAudio: existing.backgroundAudio,
      identity: existing.identity,
      tasks: existing.tasks,
      guardrails: existing.guardrails,
      whoSpeaksFirst: existing.whoSpeaksFirst,
      greeting: existing.greeting,
      outcomes: existing.outcomes,
      advanced: existing.advanced,
      tools: existing.tools,
    },
  };
  patch.revisions = [snapshot, ...(existing.revisions ?? [])].slice(0, 15);

  const agent = await updateAgent(session.userId, id, patch);
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const knowledge = await buildKnowledgeText(session.userId, agent.knowledgeBaseIds);
    const vapiId = await syncAgentToVapi(agent, knowledge);
    if (vapiId && vapiId !== agent.vapiAssistantId) {
      agent.vapiAssistantId = vapiId;
      await updateAgent(session.userId, id, { vapiAssistantId: vapiId });
    }
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
