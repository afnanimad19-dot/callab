// Vapi (vapi.ai) integration.
//
// Set VAPI_API_KEY (server) to enable. Agents sync to Vapi assistants when
// created/updated; campaigns use Vapi's outbound calling. Until the key is
// set, every function is a safe no-op so the app runs fully in demo mode.

import type { Agent } from "./db";

const BASE = "https://api.vapi.ai";

export function vapiConfigured(): boolean {
  return Boolean(process.env.VAPI_API_KEY);
}

async function vapi(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`Vapi ${res.status}: ${await res.text()}`);
  return res.json();
}

// Create or update the Vapi assistant backing one of our agents.
// Returns the Vapi assistant id (store it on the agent as vapiAssistantId).
export async function syncAgentToVapi(agent: Agent): Promise<string | null> {
  if (!vapiConfigured()) return null;

  const payload = {
    name: agent.name,
    firstMessage: agent.greeting,
    model: {
      provider: "anthropic",
      model: "claude-sonnet-5",
      messages: [{ role: "system", content: agent.systemPrompt }],
    },
    // Voice/transcriber choices are configurable in the Vapi dashboard too.
    transcriber: { provider: "deepgram" },
  };

  if (agent.vapiAssistantId) {
    await vapi(`/assistant/${agent.vapiAssistantId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return agent.vapiAssistantId;
  }
  const created = await vapi("/assistant", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return created.id as string;
}

// Start an outbound call for a campaign ("Launch your AI").
// phoneNumberId is a Vapi phone number id; customerNumber is E.164.
export async function startOutboundCall(options: {
  assistantId: string;
  phoneNumberId: string;
  customerNumber: string;
}) {
  if (!vapiConfigured()) return null;
  return vapi("/call", {
    method: "POST",
    body: JSON.stringify({
      assistantId: options.assistantId,
      phoneNumberId: options.phoneNumberId,
      customer: { number: options.customerNumber },
    }),
  });
}
