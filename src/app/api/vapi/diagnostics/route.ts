import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findAgent, listAgents, listKnowledgeBases, listPhoneNumbers, updateAgent } from "@/lib/db";
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

  // Cross-check: which of our numbers are actually present in Vapi AND
  // whether the Vapi number has an assistant assigned (required for inbound
  // calls to be answered — a missing assignment is the "silent call" bug).
  const byDigits = new Map(vapiNumbers.map((n) => [n.number.replace(/[^\d]/g, "").slice(-9), n]));
  const numberStatus = numbers.map((n) => {
    const vn = byDigits.get(n.number.replace(/[^\d]/g, "").slice(-9));
    return {
      number: n.number,
      provider: n.provider,
      agent: n.agentName || "(unassigned)",
      linkedInApp: Boolean(n.vapiPhoneNumberId),
      presentInVapi: Boolean(vn),
      // Will inbound calls actually be answered? Only if Vapi's number has an assistant.
      inboundReady: Boolean(vn?.assistantId),
    };
  });

  let agentReport:
    | {
        name: string;
        synced: boolean;
        expectedTools: string[];
        vapiTools: string[];
        missingTools: string[];
        toolSyncError: string | null;
        skippedTools: string[];
        knowledge: {
          attachedResources: { name: string; chars: number }[];
          builtChars: number; // knowledge text built locally for the prompt
          livePromptChars: number | null; // system prompt actually on Vapi
          liveHasKnowledgeSection: boolean; // "# Knowledge Base" present live
          liveHasDocumentStart: boolean; // start of the doc made it to Vapi
          liveHasDocumentEnd: boolean; // END of the doc made it (truncation check)
          verdict: string;
        };
      }
    | null = null;

  if (agentId && configured) {
    const agent = await findAgent(session.userId, agentId);
    if (agent) {
      // Re-sync so the report reflects the current config, then read back.
      let assistantId = agent.vapiAssistantId;
      let knowledge = "";
      let syncError: string | null = null;
      try {
        knowledge = await buildKnowledgeText(session.userId, agent.knowledgeBaseIds);
        const id = await syncAgentToVapi(agent, knowledge);
        if (id) {
          assistantId = id;
          if (id !== agent.vapiAssistantId) await updateAgent(session.userId, agent.id, { vapiAssistantId: id });
        }
      } catch (e) {
        syncError = (e as Error).message.slice(0, 300);
        console.error("Diagnostics sync failed:", e);
      }
      const live = assistantId ? await getVapiAssistant(assistantId) : null;

      // Knowledge verification: does the LIVE assistant prompt on Vapi contain
      // the knowledge — including the END of the document (where price lists
      // usually live), which is what silently disappears on truncation.
      const allKbs = await listKnowledgeBases(session.userId);
      const attached = allKbs.filter((k) => agent.knowledgeBaseIds?.includes(k.id));
      const livePrompt = live?.systemPrompt ?? "";
      const startProbe = knowledge.slice(200, 320).trim();
      const endProbe = knowledge.slice(-400, -280).trim();
      const kn = {
        attachedResources: attached.map((k) => ({ name: k.name, chars: k.content?.trim().length ?? 0 })),
        builtChars: knowledge.length,
        livePromptChars: live ? livePrompt.length : null,
        liveHasKnowledgeSection: livePrompt.includes("# Knowledge Base"),
        liveHasDocumentStart: Boolean(startProbe) && livePrompt.includes(startProbe),
        liveHasDocumentEnd: Boolean(endProbe) && livePrompt.includes(endProbe),
        verdict: "",
      };
      kn.verdict =
        attached.length === 0
          ? "NO KNOWLEDGE ATTACHED to this agent — open the agent editor, tick the knowledge resource, and publish."
          : attached.every((r) => !r.content?.trim())
            ? "Attached resources have NO indexed text — re-upload the document (it should show 'chars indexed')."
            : syncError
              ? `Sync to the voice pipeline FAILED: ${syncError}`
              : !live
                ? "Could not read the live assistant back — re-publish the agent."
                : kn.liveHasDocumentEnd
                  ? "OK — the full document (including the end/price list) is live in the agent's prompt."
                  : kn.liveHasKnowledgeSection
                    ? "PARTIAL — knowledge is live but the END of the document is missing (truncated). Re-publish after this update."
                    : "MISSING — the live prompt has no knowledge section. Re-publish the agent.";
      // end_call / transfer_call attach as Vapi type-tools (endCall/transferCall),
      // not by our internal name — map them so they aren't false "missing".
      const expected = [
        "book_appointment",
        "reschedule_appointment",
        "cancel_appointment",
        "find_patient",
        ...(agent.tools ?? []).map((t) =>
          t.type === "end_call" ? "endCall" : t.type === "transfer_call" ? "transferCall" : t.name
        ),
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
        knowledge: kn,
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
