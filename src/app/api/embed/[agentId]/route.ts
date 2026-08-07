import { NextResponse } from "next/server";
import { findAgentAnyUser } from "@/lib/db";

// PUBLIC endpoint backing the embeddable web-call widget. Returns only what
// the widget needs, and only for agents the owner explicitly made public.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const agent = await findAgentAnyUser(agentId);
  if (!agent || agent.visibility !== "public") {
    return NextResponse.json({ error: "This agent is not public." }, { status: 404 });
  }
  return NextResponse.json({
    name: agent.name,
    role: agent.role,
    greeting: agent.greeting,
    assistantId: agent.vapiAssistantId ?? null,
    publicKey: process.env.VAPI_PUBLIC_KEY ?? null,
  });
}
