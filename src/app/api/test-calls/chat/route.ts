import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findAgent } from "@/lib/db";
import { chatWithAssistant, vapiConfigured } from "@/lib/vapi";

// One turn of a text test with an agent. Uses Vapi's Chat API when the agent
// is synced to a Vapi assistant; otherwise falls back to a local simulated
// reply so the test panel works in demo mode too.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const agentId = String(body?.agentId ?? "");
  const input = String(body?.message ?? "").trim().slice(0, 4000);
  const previousChatId = body?.previousChatId ? String(body.previousChatId) : undefined;
  if (!input) return NextResponse.json({ error: "Message is required." }, { status: 400 });

  const agent = await findAgent(session.userId, agentId);
  if (!agent) return NextResponse.json({ error: "Agent not found." }, { status: 404 });

  if (vapiConfigured() && agent.vapiAssistantId) {
    try {
      const result = await chatWithAssistant({
        assistantId: agent.vapiAssistantId,
        input,
        previousChatId,
      });
      if (result) {
        return NextResponse.json({ reply: result.reply, chatId: result.chatId, live: true });
      }
    } catch (e) {
      console.error("Vapi chat failed, using simulated reply:", e);
    }
  }

  // Demo-mode reply: greet on the first turn, then acknowledge using the
  // agent's configured persona so the flow is still testable end to end.
  const simulated = previousChatId
    ? `Thanks — noted. As ${agent.name}, I'd handle "${input}" according to my instructions. (Simulated reply: sync this agent to Vapi to test the real model.)`
    : agent.greeting || `Hi, this is ${agent.name}. How can I help you today?`;
  return NextResponse.json({ reply: simulated, chatId: previousChatId ?? "sim", live: false });
}
