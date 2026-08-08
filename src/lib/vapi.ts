// Vapi (vapi.ai) integration.
//
// Set VAPI_API_KEY (the PRIVATE/server key) to enable. Agents sync to Vapi
// assistants when created/updated; campaigns place outbound calls; and the
// webhook at /api/vapi/webhook ingests finished calls. Until the key is set,
// every function is a safe no-op so the app runs fully in demo mode.
//
// ElevenLabs (voices) and Anthropic (the LLM) keys are configured inside the
// Vapi dashboard under Provider Keys — we only reference providers by name.

import type { Agent, Call, TranscriptTurn } from "./db";

const BASE = "https://api.vapi.ai";

export function vapiConfigured(): boolean {
  return Boolean(process.env.VAPI_API_KEY);
}

// Our friendly voice labels → ElevenLabs voice IDs (public default voices).
// Swap these for your own cloned voices' IDs when you have them.
const VOICE_MAP: Record<string, string> = {
  "Nova (female, warm)": "21m00Tcm4TlvDq8ikWAM", // Rachel
  "Atlas (male, calm)": "pNInz6obpgDQGcFmaJgB", // Adam
  "Sage (female, professional)": "EXAVITQu4vr4xnSDxMaL", // Bella
  "Orion (male, energetic)": "ErXwobaYiN019PkySvjV", // Antoni
};

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
export async function syncAgentToVapi(
  agent: Agent,
  knowledgeText?: string
): Promise<string | null> {
  if (!vapiConfigured()) return null;

  const systemPrompt = knowledgeText
    ? `${agent.systemPrompt}\n\n${knowledgeText}`
    : agent.systemPrompt;

  const adv = agent.advanced;
  const endCallPhrases = (adv?.endCallPhrases ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  // Transfer Call tool → Vapi call forwarding to the configured number.
  const transferTool = agent.tools?.find(
    (t) => t.type === "transfer_call" && t.config?.phoneNumber
  );

  const payload = {
    // Conversation tools: End Call lets the model hang up on its own.
    ...(agent.tools?.some((t) => t.name === "end_call" || t.type === "end_call")
      ? { endCallFunctionEnabled: true }
      : {}),
    ...(transferTool
      ? { forwardingPhoneNumber: transferTool.config!.phoneNumber }
      : {}),
    // Vapi-parity advanced settings from the editor's Advanced section.
    ...(adv
      ? {
          silenceTimeoutSeconds: Math.min(600, Math.max(10, adv.maxSilenceDuration)),
          maxDurationSeconds: Math.min(43200, Math.max(10, adv.maxCallDuration * 60)),
          stopSpeakingPlan: {
            numWords: adv.stopSpeakingNumWords,
            voiceSeconds: adv.stopSpeakingVoiceSeconds,
            backoffSeconds: adv.stopSpeakingBackoffSeconds,
          },
          startSpeakingPlan: {
            waitSeconds: adv.endOfSpeechTimeout,
            smartEndpointingEnabled: adv.turnDetection && adv.turnDetectionMode === "smart",
          },
          ...(adv.voicemailMessage ? { voicemailMessage: adv.voicemailMessage } : {}),
          ...(adv.endCallMessage ? { endCallMessage: adv.endCallMessage } : {}),
          ...(endCallPhrases.length ? { endCallPhrases } : {}),
          ...(adv.idleMessage
            ? {
                messagePlan: {
                  idleMessages: [adv.idleMessage],
                  idleTimeoutSeconds: adv.idleTimeout,
                  idleMessageMaxSpokenCount: adv.idleMaxCount,
                },
              }
            : {}),
          ...(adv.keypadInputEnabled
            ? {
                keypadInputPlan: {
                  enabled: true,
                  timeoutSeconds: adv.keypadInputTimeout,
                  delimiters: adv.keypadInputDelimiter === "both" ? ["#", "*"] : [adv.keypadInputDelimiter],
                },
              }
            : {}),
          ...(adv.amd
            ? {
                voicemailDetection: {
                  provider: "twilio",
                  machineDetectionTimeout: adv.amdTimeout,
                },
              }
            : {}),
          artifactPlan: {
            recordingEnabled: adv.dataStorage !== "none",
            transcriptPlan: { enabled: adv.dataStorage !== "none" },
          },
          backgroundDenoisingEnabled: adv.noiseReduction,
        }
      : {}),
    name: agent.name,
    firstMessage: agent.greeting,
    model: {
      // If Vapi rejects this model id, change it here to a model string Vapi
      // accepts for the anthropic provider — the rest of the flow is unchanged.
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      messages: [{ role: "system", content: systemPrompt }],
    },
    voice: {
      provider: "11labs",
      // voiceId is the real ElevenLabs voice picked in the editor; the named
      // VOICE_MAP is the fallback for agents created before voice previews.
      voiceId: agent.voiceId || (VOICE_MAP[agent.voice] ?? VOICE_MAP["Nova (female, warm)"]),
    },
    transcriber: { provider: "deepgram", model: "nova-2" },
    // Post-call summary/analysis, sent to our webhook (configure Server URL
    // in the Vapi dashboard, or pass server.url per-assistant here).
    analysisPlan: {
      summaryPrompt:
        "Summarize the call in 1-2 sentences: what the caller wanted and how it was resolved.",
    },
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

// Text-test an assistant via Vapi's Chat API. Returns the assistant's reply
// and a chat id to continue the same conversation on the next turn.
export async function chatWithAssistant(options: {
  assistantId: string;
  input: string;
  previousChatId?: string;
}): Promise<{ reply: string; chatId?: string } | null> {
  if (!vapiConfigured()) return null;
  const res = (await vapi("/chat", {
    method: "POST",
    body: JSON.stringify({
      assistantId: options.assistantId,
      input: options.input,
      ...(options.previousChatId ? { previousChatId: options.previousChatId } : {}),
    }),
  })) as {
    id?: string;
    output?: { role?: string; content?: string }[];
  };
  const reply =
    (res.output ?? [])
      .filter((m) => m.role === "assistant" && m.content)
      .map((m) => m.content)
      .join("\n")
      .trim() || "(no reply)";
  return { reply, chatId: res.id };
}

// Fetch a call's recording URL from Vapi by call id. Recordings become
// available shortly after a call ends, so the call-detail page uses this to
// backfill test calls (and any webhook payload that arrived without one).
export async function getCallRecording(callId: string): Promise<string | null> {
  if (!vapiConfigured()) return null;
  try {
    const call = (await vapi(`/call/${callId}`)) as {
      artifact?: { recordingUrl?: string; stereoRecordingUrl?: string; recording?: { url?: string; stereoUrl?: string } };
      recordingUrl?: string;
      stereoRecordingUrl?: string;
    };
    return (
      call.artifact?.recordingUrl ??
      call.artifact?.stereoRecordingUrl ??
      call.artifact?.recording?.url ??
      call.artifact?.recording?.stereoUrl ??
      call.recordingUrl ??
      call.stereoRecordingUrl ??
      null
    );
  } catch (e) {
    console.error("Recording fetch failed:", e);
    return null;
  }
}

// --- Webhook mapping --------------------------------------------------------
// Convert a Vapi "end-of-call-report" message into our Call shape. Vapi's
// payload is deeply nested and can vary by version, so every field is read
// defensively with a sensible fallback.

interface VapiMessage {
  type?: string;
  endedReason?: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  summary?: string;
  transcript?: string;
  recordingUrl?: string;
  stereoRecordingUrl?: string;
  call?: {
    id?: string;
    assistantId?: string;
    type?: string;
    customer?: { number?: string };
  };
  assistant?: { id?: string };
  analysis?: { summary?: string; successEvaluation?: string | boolean };
  artifact?: {
    messages?: { role?: string; message?: string; secondsFromStart?: number }[];
    recordingUrl?: string;
    stereoRecordingUrl?: string;
    recording?: { url?: string; stereoUrl?: string };
  };
}

export function getAssistantId(message: VapiMessage): string | undefined {
  return message.call?.assistantId ?? message.assistant?.id;
}

function mapTranscript(message: VapiMessage): TranscriptTurn[] {
  const msgs = message.artifact?.messages ?? [];
  const turns: TranscriptTurn[] = [];
  for (const m of msgs) {
    if (m.role === "assistant" || m.role === "bot") {
      turns.push({ speaker: "agent", text: m.message ?? "", at: Math.round(m.secondsFromStart ?? 0) });
    } else if (m.role === "user" || m.role === "customer") {
      turns.push({ speaker: "caller", text: m.message ?? "", at: Math.round(m.secondsFromStart ?? 0) });
    }
    // system/tool messages are skipped
  }
  return turns;
}

function mapOutcome(endedReason?: string): Call["outcome"] {
  const r = (endedReason ?? "").toLowerCase();
  if (r.includes("transfer") || r.includes("forward")) return "escalated";
  if (r.includes("voicemail")) return "voicemail";
  if (r.includes("no-answer") || r.includes("busy")) return "callback_scheduled";
  return "resolved";
}

export function mapEndOfCallReport(
  message: VapiMessage,
  agent: Agent
): Call {
  const durationSec =
    message.durationSeconds ??
    (message.startedAt && message.endedAt
      ? Math.max(
          0,
          Math.round(
            (Date.parse(message.endedAt) - Date.parse(message.startedAt)) / 1000
          )
        )
      : 0);

  const success = message.analysis?.successEvaluation;
  const positive = success === true || success === "true" || success === "pass";

  return {
    id: `call_${(message.call?.id ?? crypto.randomUUID()).replace(/-/g, "").slice(0, 20)}`,
    userId: agent.userId,
    agentId: agent.id,
    agentName: agent.name,
    callerNumber: message.call?.customer?.number ?? "Unknown",
    direction: (message.call?.type ?? "").toLowerCase().includes("outbound")
      ? "outbound"
      : "inbound",
    startedAt: message.startedAt ?? new Date().toISOString(),
    durationSec,
    outcome: mapOutcome(message.endedReason),
    endReason: message.endedReason ?? "completed",
    sentiment: positive ? "positive" : "neutral",
    confidence: positive ? 0.9 : 0.7,
    summary:
      message.analysis?.summary ??
      message.summary ??
      "Call completed. (No summary provided by the voice pipeline.)",
    transcript: mapTranscript(message),
    // Vapi has moved the recording URL between fields across versions — check
    // every known location.
    recordingUrl:
      message.recordingUrl ??
      message.stereoRecordingUrl ??
      message.artifact?.recordingUrl ??
      message.artifact?.stereoRecordingUrl ??
      message.artifact?.recording?.url ??
      message.artifact?.recording?.stereoUrl,
    vapiCallId: message.call?.id,
  };
}
