import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findAgent, listAgents, listPhoneNumbers, updateAgent } from "@/lib/db";
import {
  getVapiAssistant, lastToolSyncError, lastSkippedTools, listVapiNumbers,
  syncAgentToVapi, vapiConfigured,
} from "@/lib/vapi";
import { buildKnowledgeText } from "@/lib/knowledge";

// One-stop Vapi health check: is the server key set, what does the connected
// account actually contain (phone numbers), and — for a given agent — does
// its Vapi assistant have the tools we expect, or what error blocked them.
// Pass ?agentId=... to re-sync that agent and read its live tools back.
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configured = vapiConfigured();
  const agentId = new URL(request.url).searchParams.get("agentId");

  const [numbers, vapiNumbers] = await Promise.all([
    listPhoneNumbers(session.userId),
    configured ? listVapiNumbers() : Promise.resolve([]),
  ]);

  // Cross-check: which of our numbers are actually present in Vapi.
  const vapiDigits = new Set(vapiNumbers.map((n) => n.number.replace(/[^\d]/g, "").slice(-9)));
  const numberStatus = numbers.map((n) => ({
    number: n.number,
    provider: n.provider,
    agent: n.agentName || "(unassigned)",
    linkedInApp: Boolean(n.vapiPhoneNumberId),
    presentInVapi: vapiDigits.has(n.number.replace(/[^\d]/g, "").slice(-9)),
  }));

  let agentReport:
    | {
        name: string;
        synced: boolean;
        expectedTools: string[];
        vapiTools: string[];
        missingTools: string[];
        toolSyncError: string | null;
        skippedTools: string[];
      }
    | null = null;

  if (agentId && configured) {
    const agent = await findAgent(session.userId, agentId);
    if (agent) {
      // Re-sync so the report reflects the current config, then read back.
      let assistantId = agent.vapiAssistantId;
      try {
        const knowledge = await buildKnowledgeText(session.userId, agent.knowledgeBaseIds);
        const id = await syncAgentToVapi(agent, knowledge);
        if (id) {
          assistantId = id;
          if (id !== agent.vapiAssistantId) await updateAgent(session.userId, agent.id, { vapiAssistantId: id });
        }
      } catch (e) {
        console.error("Diagnostics sync failed:", e);
      }
      const live = assistantId ? await getVapiAssistant(assistantId) : null;
      const expected = [
        "book_appointment",
        "reschedule_appointment",
        "cancel_appointment",
        "find_patient",
        ...(agent.tools ?? []).map((t) => t.name),
      ];
      const vapiTools = live?.toolNames ?? [];
      agentReport = {
        name: agent.name,
        synced: Boolean(assistantId),
        expectedTools: [...new Set(expected)],
        vapiTools,
        missingTools: [...new Set(expected)].filter((t) => !vapiTools.includes(t)),
        toolSyncError: lastToolSyncError.get(agent.id) ?? null,
        skippedTools: lastSkippedTools.get(agent.id) ?? [],
      };
    }
  }

  return NextResponse.json({
    vapiConfigured: configured,
    hint: configured
      ? undefined
      : "Set VAPI_API_KEY (private) and VAPI_PUBLIC_KEY in your Netlify environment variables.",
    siteUrl: process.env.SITE_URL ?? process.env.URL ?? null,
    siteUrlOk: Boolean(process.env.SITE_URL ?? process.env.URL),
    agents: (await listAgents(session.userId)).map((a) => ({ id: a.id, name: a.name, synced: Boolean(a.vapiAssistantId) })),
    numbers: numberStatus,
    vapiNumberCount: vapiNumbers.length,
    agentReport,
  });
}
