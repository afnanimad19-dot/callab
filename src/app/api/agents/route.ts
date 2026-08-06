import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createAgent, listAgents, newId } from "@/lib/db";
import { syncAgentToVapi } from "@/lib/vapi";

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
    status: "draft",
    createdAt: new Date().toISOString(),
  });

  // Best-effort Vapi sync; the agent still saves if Vapi isn't configured.
  try {
    const vapiId = await syncAgentToVapi(agent);
    if (vapiId) agent.vapiAssistantId = vapiId;
  } catch (e) {
    console.error("Vapi sync failed:", e);
  }

  return NextResponse.json({ agent }, { status: 201 });
}
