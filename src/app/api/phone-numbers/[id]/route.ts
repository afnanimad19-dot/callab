import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deletePhoneNumber, findAgent, listPhoneNumbers, updateAgent, updatePhoneNumber } from "@/lib/db";
import { assignNumberToAssistant, syncAgentToVapi } from "@/lib/vapi";
import { buildKnowledgeText } from "@/lib/knowledge";

// Assign (or unassign) an agent to a number. With a Vapi-linked number this
// updates the Vapi phone number's assistantId, so INBOUND calls to it are
// answered by that agent.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const record = (await listPhoneNumbers(session.userId)).find((n) => n.id === id);
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body?.agentId === null || body?.agentId === "") {
    if (record.vapiPhoneNumberId) {
      try { await assignNumberToAssistant(record.vapiPhoneNumberId, null); }
      catch (e) { console.error("Unassign failed:", e); }
    }
    const updated = await updatePhoneNumber(session.userId, id, {
      agentName: "", status: "unassigned", updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ phoneNumber: updated });
  }

  if (typeof body?.agentId === "string") {
    const agent = await findAgent(session.userId, body.agentId);
    if (!agent) return NextResponse.json({ error: "Agent not found." }, { status: 404 });

    let assistantId = agent.vapiAssistantId;
    if (!assistantId) {
      try {
        const knowledge = await buildKnowledgeText(session.userId, agent.knowledgeBaseIds);
        assistantId = (await syncAgentToVapi(agent, knowledge)) ?? undefined;
        if (assistantId) await updateAgent(session.userId, agent.id, { vapiAssistantId: assistantId });
      } catch (e) {
        console.error("Sync before number assignment failed:", e);
      }
    }
    if (record.vapiPhoneNumberId && assistantId) {
      try {
        await assignNumberToAssistant(record.vapiPhoneNumberId, assistantId);
      } catch (e) {
        return NextResponse.json(
          { error: `Could not route the number to this agent: ${(e as Error).message.slice(0, 200)}` },
          { status: 502 }
        );
      }
    }
    const routed = Boolean(record.vapiPhoneNumberId && assistantId);
    const updated = await updatePhoneNumber(session.userId, id, {
      agentName: agent.name,
      // Only truly "active" (calls will ring) once the number is linked in Vapi.
      status: routed ? "active" : "unassigned",
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({
      phoneNumber: updated,
      routed,
      warning: routed
        ? undefined
        : "The agent is assigned, but this number is NOT linked to the voice pipeline, so inbound calls won't ring yet. Remove it and re-add it with its Twilio/SIP credentials.",
    });
  }

  return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const removed = await deletePhoneNumber(session.userId, id);
  if (!removed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
