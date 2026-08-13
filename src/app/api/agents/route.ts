import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createAgent, findUserById, listAgents, newId, updateAgent, Agent, DEFAULT_TOOLS } from "@/lib/db";
import { sanitizeAdvanced, sanitizeOutcomes, sanitizeTools } from "@/lib/agent-sanitize";
import { syncAgentToVapi } from "@/lib/vapi";
import { buildKnowledgeText } from "@/lib/knowledge";
import { agentLimit, getPlanTier } from "@/lib/plans";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ agents: await listAgents(session.userId) });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Agent name is required." }, { status: 400 });
  }

  // Plan limit: block creating more agents than the tier allows.
  const owner = await findUserById(session.userId);
  const limit = agentLimit(owner);
  const existing = (await listAgents(session.userId)).length;
  if (existing >= limit) {
    return NextResponse.json(
      {
        error: `Your ${getPlanTier(owner).name} plan includes ${limit} agents. Upgrade your plan to add more.`,
        upgrade: true,
      },
      { status: 403 }
    );
  }

  const status = ["active", "paused", "draft"].includes(body?.status)
    ? (body.status as Agent["status"])
    : "draft";

  const agent = await createAgent({
    id: newId("agt"),
    userId: session.userId,
    name,
    role: String(body?.role ?? "").trim() || "General assistant",
    voice: String(body?.voice ?? "Nova (female, warm)"),
    language: String(body?.language ?? "English (US)"),
    greeting:
      String(body?.greeting ?? "").trim() ||
      "Thanks for calling — how can I help you today?",
    systemPrompt: String(body?.systemPrompt ?? "").trim(),
    phoneNumber: String(body?.phoneNumber ?? "").trim() || "Not assigned",
    status,
    createdAt: new Date().toISOString(),
    agentType:
      body?.agentType === "conversation_flow" ? "conversation_flow" : "single_prompt",
    version: 1,
    backgroundAudio: String(body?.backgroundAudio ?? "None"),
    identity: String(body?.identity ?? ""),
    tasks: String(body?.tasks ?? ""),
    guardrails: String(body?.guardrails ?? ""),
    whoSpeaksFirst: body?.whoSpeaksFirst === "caller" ? "caller" : "agent",
    outcomes: sanitizeOutcomes(body?.outcomes),
    advanced: sanitizeAdvanced(body?.advanced),
    tools: body?.tools !== undefined ? sanitizeTools(body.tools) : DEFAULT_TOOLS,
    visibility: "private",
    voiceId: typeof body?.voiceId === "string" ? body.voiceId.slice(0, 60) : undefined,
    knowledgeBaseIds: Array.isArray(body?.knowledgeBaseIds)
      ? body.knowledgeBaseIds.map(String).slice(0, 20)
      : [],
    speedPreset: ["balanced", "high_intelligence", "ultra_fast", "cost_saver"].includes(body?.speedPreset)
      ? body.speedPreset
      : "balanced",
    llmModel: typeof body?.llmModel === "string" ? body.llmModel.slice(0, 80) : undefined,
    voiceModel: typeof body?.voiceModel === "string" ? body.voiceModel.slice(0, 60) : undefined,
    transcriberModel: typeof body?.transcriberModel === "string" ? body.transcriberModel.slice(0, 40) : undefined,
  });

  // Best-effort Vapi sync; the agent still saves if Vapi isn't configured.
  // The assistant id must be PERSISTED, not just set on the local object.
  try {
    const knowledge = await buildKnowledgeText(session.userId, agent.knowledgeBaseIds);
    const vapiId = await syncAgentToVapi(agent, knowledge);
    if (vapiId) {
      agent.vapiAssistantId = vapiId;
      await updateAgent(session.userId, agent.id, { vapiAssistantId: vapiId });
    }
  } catch (e) {
    console.error("Vapi sync failed:", e);
  }

  return NextResponse.json({ agent }, { status: 201 });
}
