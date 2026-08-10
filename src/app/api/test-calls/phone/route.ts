import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findAgent, listPhoneNumbers, updateAgent } from "@/lib/db";
import { startOutboundCall, syncAgentToVapi } from "@/lib/vapi";
import { buildKnowledgeText } from "@/lib/knowledge";
import { getUsage } from "@/lib/usage";

// Start a real test call to the user's own phone: Vapi dials out from one of
// the workspace's numbers with the selected agent, optionally passing dynamic
// variables ({{key}}) into the assistant.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const usage = await getUsage(session.userId);
  if (usage.over) {
    return NextResponse.json(
      { error: `You've used all ${usage.totalMinutes.toLocaleString()} minutes this cycle. Top up in Billing to make calls.` },
      { status: 402 }
    );
  }

  const body = await request.json().catch(() => null);
  const agent = await findAgent(session.userId, String(body?.agentId ?? ""));
  if (!agent) return NextResponse.json({ error: "Agent not found." }, { status: 404 });

  const customerNumber = String(body?.customerNumber ?? "").replace(/[^\d+]/g, "");
  if (!/^\+\d{6,15}$/.test(customerNumber)) {
    return NextResponse.json(
      { error: "Enter a valid phone number including country code." },
      { status: 400 }
    );
  }

  const numbers = await listPhoneNumbers(session.userId);
  const from = numbers.find((n) => n.id === String(body?.phoneNumberId ?? ""));
  if (!from) return NextResponse.json({ error: "Select a number to call from." }, { status: 400 });
  if (!from.vapiPhoneNumberId) {
    return NextResponse.json(
      { error: `"${from.number}" is not linked to the calling system — import it in Phone Numbers first.` },
      { status: 400 }
    );
  }

  // Sync the agent to Vapi on the fly if needed.
  let assistantId = agent.vapiAssistantId;
  if (!assistantId) {
    try {
      const knowledge = await buildKnowledgeText(session.userId, agent.knowledgeBaseIds);
      assistantId = (await syncAgentToVapi(agent, knowledge)) ?? undefined;
      if (assistantId) await updateAgent(session.userId, agent.id, { vapiAssistantId: assistantId });
    } catch (e) {
      console.error("Sync before test call failed:", e);
    }
  }
  if (!assistantId) {
    return NextResponse.json(
      { error: "This agent isn't synced to Vapi — check VAPI_API_KEY and publish the agent." },
      { status: 400 }
    );
  }

  const variableValues: Record<string, string> = {};
  if (body?.variables && typeof body.variables === "object") {
    for (const [k, v] of Object.entries(body.variables).slice(0, 20)) {
      if (k) variableValues[String(k).slice(0, 60)] = String(v).slice(0, 500);
    }
  }

  try {
    const call = (await startOutboundCall({
      assistantId,
      phoneNumberId: from.vapiPhoneNumberId,
      customerNumber,
      variableValues,
    })) as { id?: string } | null;
    if (!call) {
      return NextResponse.json({ error: "The calling system is not configured on the server." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, vapiCallId: call.id ?? null });
  } catch (e) {
    return NextResponse.json(
      { error: `Could not start the call: ${(e as Error).message}` },
      { status: 502 }
    );
  }
}
