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

// --- Tool building ----------------------------------------------------------
// Turns the agent's configured tools into REAL Vapi tools that execute
// mid-call. Live Webhooks and Zapier point straight at the external URL;
// Send Email and Cal.com run through our /api/tools/execute endpoint.

function parseHeaders(json?: string): Record<string, string> | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object") {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) out[k] = String(v);
      return out;
    }
  } catch {
    // Malformed header JSON is ignored rather than breaking the sync.
  }
  return undefined;
}

// {{variable}} placeholders in a webhook body template become the tool's
// parameters, so the model knows what to collect and send.
function paramsFromTemplate(template?: string) {
  const names = [...new Set([...(template ?? "").matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]))];
  const properties: Record<string, { type: string; description: string }> = {};
  for (const n of names) properties[n] = { type: "string", description: n.replaceAll("_", " ") };
  return { type: "object" as const, properties, required: names };
}

function siteUrl(): string | null {
  // Netlify sets URL to the site's canonical URL; SITE_URL is a manual override.
  return process.env.SITE_URL ?? process.env.URL ?? null;
}

export function buildVapiTools(agent: Agent): unknown[] {
  const tools: unknown[] = [];
  const site = siteUrl();
  const executeServer = (toolId: string) => ({
    url: `${site}/api/tools/execute?agentId=${agent.id}&toolId=${toolId}`,
    ...(process.env.VAPI_WEBHOOK_SECRET
      ? { headers: { "x-vl-secret": process.env.VAPI_WEBHOOK_SECRET } }
      : {}),
  });

  for (const t of agent.tools ?? []) {
    const cfg = t.config ?? {};
    switch (t.type) {
      case "customer_memory": {
        // Two tools backed by OUR contacts + call history: the agent can
        // recognise returning customers and remember new ones.
        if (!site) break;
        tools.push(
          {
            type: "function",
            async: false,
            function: {
              name: "lookup_customer",
              description:
                "Look up whether the caller is an existing customer/patient. Call when the caller says they've been here before, gives their name, or you need their history. Returns their details and last visit.",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "The caller's name, if they gave it" },
                  phone: { type: "string", description: "The caller's phone number, if known" },
                },
                required: [],
              },
            },
            server: executeServer(t.id),
          },
          {
            type: "function",
            async: false,
            function: {
              name: "save_customer",
              description:
                "Save or update the caller's details in the customer database — name, phone, email, and any notes worth remembering for their next call.",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "The caller's full name" },
                  phone: { type: "string", description: "The caller's phone number" },
                  email: { type: "string", description: "The caller's email address" },
                  notes: { type: "string", description: "Anything worth remembering next time" },
                },
                required: ["name"],
              },
            },
            server: executeServer(t.id),
          }
        );
        break;
      }
      case "voicemail": {
        tools.push({ type: "voicemail", function: { name: t.name } });
        break;
      }
      case "dtmf": {
        tools.push({ type: "dtmf", function: { name: t.name } });
        break;
      }
      case "sms": {
        tools.push({ type: "sms", function: { name: t.name }, metadata: {} });
        break;
      }
      case "gcal_create": {
        tools.push({ type: "google.calendar.event.create", function: { name: t.name } });
        break;
      }
      case "gcal_availability": {
        tools.push({ type: "google.calendar.availability.check", function: { name: t.name } });
        break;
      }
      case "gsheets": {
        tools.push({ type: "google.sheets.row.append", function: { name: t.name } });
        break;
      }
      case "slack": {
        tools.push({ type: "slack.message.send", function: { name: t.name } });
        break;
      }
      case "ghl": {
        tools.push({ type: "gohighlevel.contact.create", function: { name: t.name } });
        break;
      }
      case "custom": {
        // Callab-style custom tool: server URL + user-defined properties.
        if (!cfg.serverUrl) break;
        let props: { name: string; type?: string; description?: string; required?: boolean }[] = [];
        try {
          props = JSON.parse(cfg.properties ?? "[]");
        } catch {}
        const properties: Record<string, { type: string; description: string }> = {};
        const required: string[] = [];
        for (const p of props) {
          if (!p?.name) continue;
          properties[p.name] = {
            type: ["string", "number", "boolean"].includes(p.type ?? "") ? p.type! : "string",
            description: p.description ?? p.name,
          };
          if (p.required) required.push(p.name);
        }
        tools.push({
          type: "function",
          async: false,
          function: { name: t.name, description: t.description, parameters: { type: "object", properties, required } },
          server: {
            url: cfg.serverUrl,
            ...(parseHeaders(cfg.httpHeaders) ? { headers: parseHeaders(cfg.httpHeaders) } : {}),
          },
        });
        break;
      }
      case "live_webhook": {
        if (!cfg.serverUrl) break;
        tools.push({
          type: "function",
          async: false,
          function: {
            name: t.name,
            description: t.description,
            parameters: paramsFromTemplate(cfg.body),
          },
          server: {
            url: cfg.serverUrl,
            ...(parseHeaders(cfg.httpHeaders) ? { headers: parseHeaders(cfg.httpHeaders) } : {}),
          },
        });
        break;
      }
      case "zapier": {
        if (!cfg.zapierUrl) break;
        let fields: { name: string; description: string }[] = [];
        try {
          fields = JSON.parse(cfg.fields ?? "[]");
        } catch {}
        const properties: Record<string, { type: string; description: string }> = {};
        for (const f of fields) {
          if (f?.name) properties[f.name] = { type: "string", description: f.description ?? f.name };
        }
        tools.push({
          type: "function",
          async: true,
          function: {
            name: t.name,
            description: t.description,
            parameters: { type: "object", properties, required: [] },
          },
          server: { url: cfg.zapierUrl },
        });
        break;
      }
      case "send_email": {
        if (!site) break; // needs the deployed site URL to call back into
        tools.push({
          type: "function",
          async: true,
          function: {
            name: t.name,
            description: `${t.description}. Collect the caller's email address first.`,
            parameters: {
              type: "object",
              properties: {
                email: { type: "string", description: "The caller's email address" },
                summary: { type: "string", description: "Short summary of what was discussed" },
              },
              required: ["email"],
            },
          },
          server: {
            url: `${site}/api/tools/execute?agentId=${agent.id}&toolId=${t.id}`,
            ...(process.env.VAPI_WEBHOOK_SECRET
              ? { headers: { "x-vl-secret": process.env.VAPI_WEBHOOK_SECRET } }
              : {}),
          },
        });
        break;
      }
      case "cal_com": {
        if (!site || !cfg.calApiKey) break;
        tools.push({
          type: "function",
          async: false,
          function: {
            name: t.name,
            description: `${t.description}. Collect the caller's name, email, and preferred date/time first.`,
            parameters: {
              type: "object",
              properties: {
                name: { type: "string", description: "The caller's full name" },
                email: { type: "string", description: "The caller's email address" },
                start: { type: "string", description: "Meeting start in ISO format, e.g. 2026-08-12T15:00:00Z" },
              },
              required: ["name", "email", "start"],
            },
          },
          server: {
            url: `${site}/api/tools/execute?agentId=${agent.id}&toolId=${t.id}`,
            ...(process.env.VAPI_WEBHOOK_SECRET
              ? { headers: { "x-vl-secret": process.env.VAPI_WEBHOOK_SECRET } }
              : {}),
          },
        });
        break;
      }
      case "mcp": {
        if (!cfg.serverUrl || cfg.serverUrl.includes("your-mcp-server")) break;
        tools.push({
          type: "mcp",
          function: { name: t.name },
          server: {
            url: cfg.serverUrl,
            ...(parseHeaders(cfg.httpHeaders) ? { headers: parseHeaders(cfg.httpHeaders) } : {}),
          },
        });
        break;
      }
      default:
        break; // end_call / transfer_call / knowledge_base map elsewhere
    }
  }

  // Built-in appointment tools — every agent can book, reschedule and cancel
  // appointments. Results land on the Calendar tab, create Contacts, and sync
  // to Google Calendar when the workspace has connected one.
  if (site) {
    const calServer = executeServer("builtin_calendar");
    tools.push(
      {
        type: "function",
        async: false,
        function: {
          name: "book_appointment",
          description:
            "Book an appointment for the caller. Call this once the patient has confirmed a date and time. Always collect the patient's name first.",
          parameters: {
            type: "object",
            properties: {
              patient_name: { type: "string", description: "The patient's full name" },
              phone: { type: "string", description: "The patient's phone number" },
              doctor: { type: "string", description: "Doctor or staff member the appointment is with" },
              service: { type: "string", description: "Service or treatment, e.g. cleaning, consultation" },
              datetime: { type: "string", description: "Appointment start in ISO format, e.g. 2026-08-12T15:30:00" },
              notes: { type: "string", description: "Any extra notes about the appointment" },
            },
            required: ["patient_name", "datetime"],
          },
        },
        server: calServer,
      },
      {
        type: "function",
        async: false,
        function: {
          name: "reschedule_appointment",
          description:
            "Move the caller's existing appointment to a new date/time. Identify the patient by name or phone number.",
          parameters: {
            type: "object",
            properties: {
              patient_name: { type: "string", description: "The patient's full name" },
              phone: { type: "string", description: "The patient's phone number" },
              new_datetime: { type: "string", description: "New start in ISO format, e.g. 2026-08-12T15:30:00" },
            },
            required: ["new_datetime"],
          },
        },
        server: calServer,
      },
      {
        type: "function",
        async: false,
        function: {
          name: "cancel_appointment",
          description:
            "Cancel the caller's existing appointment. Identify the patient by name or phone number and confirm before canceling.",
          parameters: {
            type: "object",
            properties: {
              patient_name: { type: "string", description: "The patient's full name" },
              phone: { type: "string", description: "The patient's phone number" },
            },
            required: [],
          },
        },
        server: calServer,
      }
    );
  }

  return tools;
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
      ...(buildVapiTools(agent).length ? { tools: buildVapiTools(agent) } : {}),
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

  // If Vapi rejects the payload (e.g. a tool shape it doesn't accept), retry
  // once without custom tools so the assistant itself always stays in sync.
  async function push(body: Record<string, unknown>): Promise<string> {
    if (agent.vapiAssistantId) {
      await vapi(`/assistant/${agent.vapiAssistantId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      return agent.vapiAssistantId;
    }
    const created = await vapi("/assistant", { method: "POST", body: JSON.stringify(body) });
    return created.id as string;
  }

  // Staged fallback: full payload → function-type tools only (the named
  // provider tools need credentials linked in the Vapi dashboard and may be
  // rejected) → no custom tools. The assistant itself always stays in sync.
  const model = payload.model as Record<string, unknown> & { tools?: { type?: string }[] };
  try {
    return await push(payload);
  } catch (e) {
    if (!model.tools) throw e;
    const functionTools = model.tools.filter((t) => t.type === "function");
    if (functionTools.length > 0 && functionTools.length < model.tools.length) {
      console.error("Vapi rejected the tool set — retrying with function tools only:", e);
      try {
        return await push({ ...payload, model: { ...model, tools: functionTools } });
      } catch (e2) {
        console.error("Function-only tools also rejected — retrying without tools:", e2);
      }
    } else {
      console.error("Vapi rejected custom tools — retrying without them:", e);
    }
    const modelSansTools = { ...model };
    delete modelSansTools.tools;
    return await push({ ...payload, model: modelSansTools });
  }
}

// --- Phone numbers ----------------------------------------------------------

// Import a Twilio number into Vapi. Vapi links to the Twilio account and
// configures the number's voice webhook so INBOUND calls are answered by the
// assigned assistant. Credentials go straight to Vapi — never our database.
export async function importTwilioNumber(options: {
  number: string; // E.164
  accountSid: string;
  authToken: string;
  name?: string;
  assistantId?: string;
}): Promise<string | null> {
  if (!vapiConfigured()) return null;
  const created = (await vapi("/phone-number", {
    method: "POST",
    body: JSON.stringify({
      provider: "twilio",
      number: options.number,
      twilioAccountSid: options.accountSid,
      twilioAuthToken: options.authToken,
      ...(options.name ? { name: options.name } : {}),
      ...(options.assistantId ? { assistantId: options.assistantId } : {}),
    }),
  })) as { id?: string };
  return created.id ?? null;
}

// Connect a number that lives behind the user's own SIP trunk (BYO carrier):
// first a byo-sip-trunk credential, then the number bound to it.
export async function importSipNumber(options: {
  number: string;
  gateway: string; // SIP host/IP
  username?: string;
  password?: string;
  name?: string;
}): Promise<string | null> {
  if (!vapiConfigured()) return null;
  const credential = (await vapi("/credential", {
    method: "POST",
    body: JSON.stringify({
      provider: "byo-sip-trunk",
      name: options.name ?? `SIP trunk ${options.gateway}`,
      gateways: [{ ip: options.gateway }],
      ...(options.username && options.password
        ? {
            outboundAuthenticationPlan: {
              authUsername: options.username,
              authPassword: options.password,
            },
          }
        : {}),
    }),
  })) as { id?: string };
  if (!credential.id) return null;
  const created = (await vapi("/phone-number", {
    method: "POST",
    body: JSON.stringify({
      provider: "byo-phone-number",
      number: options.number,
      numberE164CheckEnabled: false,
      credentialId: credential.id,
      ...(options.name ? { name: options.name } : {}),
    }),
  })) as { id?: string };
  return created.id ?? null;
}

// Find an existing number in the connected Vapi account (for "Vapi Number").
export async function findVapiNumber(number: string): Promise<string | null> {
  if (!vapiConfigured()) return null;
  const digits = number.replace(/[^\d]/g, "");
  const list = (await vapi("/phone-number")) as { id?: string; number?: string }[];
  const hit = (Array.isArray(list) ? list : []).find(
    (n) => (n.number ?? "").replace(/[^\d]/g, "").endsWith(digits.slice(-9))
  );
  return hit?.id ?? null;
}

// Route INBOUND calls on a number to an assistant.
export async function assignNumberToAssistant(
  vapiPhoneNumberId: string,
  assistantId: string | null
): Promise<void> {
  if (!vapiConfigured()) return;
  await vapi(`/phone-number/${vapiPhoneNumberId}`, {
    method: "PATCH",
    body: JSON.stringify({ assistantId }),
  });
}

// Start an outbound call for a campaign ("Launch your AI").
// phoneNumberId is a Vapi phone number id; customerNumber is E.164.
export async function startOutboundCall(options: {
  assistantId: string;
  phoneNumberId: string;
  customerNumber: string;
  variableValues?: Record<string, string>;
}) {
  if (!vapiConfigured()) return null;
  return vapi("/call", {
    method: "POST",
    body: JSON.stringify({
      assistantId: options.assistantId,
      phoneNumberId: options.phoneNumberId,
      customer: { number: options.customerNumber },
      ...(options.variableValues && Object.keys(options.variableValues).length
        ? { assistantOverrides: { variableValues: options.variableValues } }
        : {}),
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
      artifact?: {
        recordingUrl?: string;
        stereoRecordingUrl?: string;
        recording?: {
          url?: string;
          stereoUrl?: string;
          mono?: { combinedUrl?: string; assistantUrl?: string; customerUrl?: string };
        };
      };
      recordingUrl?: string;
      stereoRecordingUrl?: string;
    };
    const known =
      call.artifact?.recordingUrl ??
      call.artifact?.stereoRecordingUrl ??
      call.artifact?.recording?.stereoUrl ??
      call.artifact?.recording?.url ??
      call.artifact?.recording?.mono?.combinedUrl ??
      call.recordingUrl ??
      call.stereoRecordingUrl ??
      null;
    if (known) return known;
    // Vapi has moved the recording field between versions — as a last resort,
    // deep-scan the payload for anything that looks like a recording URL
    // (audio extension, Vapi storage host, or a "recording" path).
    const found: string[] = [];
    (function scan(v: unknown) {
      if (typeof v === "string") {
        if (
          /^https?:\/\//i.test(v) &&
          (/\.(wav|mp3|ogg|m4a|flac|webm)(\?|$)/i.test(v) ||
            /storage\.vapi\.ai/i.test(v) ||
            /recording/i.test(v))
        ) {
          found.push(v);
        }
      } else if (Array.isArray(v)) v.forEach(scan);
      else if (v && typeof v === "object") Object.values(v).forEach(scan);
    })(call);
    if (found.length === 0) {
      console.error(
        `No recording URL in Vapi call ${callId} — payload keys:`,
        JSON.stringify(Object.keys(call as object)),
        "artifact keys:",
        JSON.stringify(Object.keys((call as { artifact?: object }).artifact ?? {}))
      );
    }
    return found[0] ?? null;
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
