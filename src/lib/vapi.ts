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
import { resolveEngine } from "./voice-presets";

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

// The last error Vapi returned while syncing an assistant's TOOLS, if any.
// Keyed by agent id so the editor can show "tools didn't sync — here's why".
export const lastToolSyncError = new Map<string, string>();

// Tools skipped because they point at a placeholder URL (example.com etc.),
// keyed by agent id — surfaced in diagnostics so the user knows to fix them.
export const lastSkippedTools = new Map<string, string[]>();

// Read the live assistant back from Vapi (id, tool names, model) so the UI
// and diagnostics can show what ACTUALLY exists on Vapi's side.
export async function getVapiAssistant(assistantId: string): Promise<{
  id: string;
  name?: string;
  toolNames: string[];
  model?: string;
} | null> {
  if (!vapiConfigured()) return null;
  try {
    const a = (await vapi(`/assistant/${assistantId}`)) as {
      id: string;
      name?: string;
      model?: { model?: string; tools?: { function?: { name?: string }; type?: string }[] };
    };
    const toolNames = (a.model?.tools ?? []).map((t) => t.function?.name ?? t.type ?? "tool");
    return { id: a.id, name: a.name, toolNames, model: a.model?.model };
  } catch (e) {
    console.error("getVapiAssistant failed:", e);
    return null;
  }
}

// List phone numbers currently in the connected Vapi account.
export async function listVapiNumbers(): Promise<{ id: string; number: string; assistantId?: string }[]> {
  if (!vapiConfigured()) return [];
  try {
    const list = (await vapi("/phone-number")) as { id: string; number?: string; assistantId?: string }[];
    return (Array.isArray(list) ? list : []).map((n) => ({
      id: n.id,
      number: n.number ?? "",
      assistantId: n.assistantId,
    }));
  } catch (e) {
    console.error("listVapiNumbers failed:", e);
    return [];
  }
}

// Live monitoring: the calls Vapi currently has ON THE LINE. Vapi marks calls
// queued → ringing → in-progress → forwarding → ended; we surface everything
// that hasn't ended yet. Each carries a monitor.listenUrl (a live audio
// WebSocket) that the Vapi dashboard uses to listen in.
export interface ActiveVapiCall {
  id: string;
  assistantId?: string;
  status: string;
  customerNumber?: string;
  startedAt?: string;
  createdAt?: string;
  listenUrl?: string;
  controlUrl?: string;
}
const ACTIVE_STATUSES = new Set(["queued", "ringing", "in-progress", "forwarding"]);
export async function listActiveVapiCalls(): Promise<ActiveVapiCall[]> {
  if (!vapiConfigured()) return [];
  try {
    const list = (await vapi("/call?limit=100")) as Array<{
      id: string;
      status?: string;
      assistantId?: string;
      assistant?: { id?: string };
      customer?: { number?: string };
      startedAt?: string;
      createdAt?: string;
      monitor?: { listenUrl?: string; controlUrl?: string };
    }>;
    return (Array.isArray(list) ? list : [])
      .filter((c) => c.status && ACTIVE_STATUSES.has(c.status))
      .map((c) => ({
        id: c.id,
        assistantId: c.assistantId ?? c.assistant?.id,
        status: c.status ?? "in-progress",
        customerNumber: c.customer?.number,
        startedAt: c.startedAt,
        createdAt: c.createdAt,
        listenUrl: c.monitor?.listenUrl,
        controlUrl: c.monitor?.controlUrl,
      }));
  } catch (e) {
    console.error("listActiveVapiCalls failed:", e);
    return [];
  }
}

// Recently-ENDED calls in the Vapi account, used to backfill Call Logs when a
// webhook was missed (e.g. an inbound call placed before the assistant carried
// a server URL). Returns everything needed to build a Call row.
export interface RecentVapiCall {
  id: string;
  assistantId?: string;
  direction: "inbound" | "outbound";
  customerNumber?: string;
  startedAt?: string;
  endedAt?: string;
  endedReason?: string;
  summary?: string;
}
export async function listRecentVapiCalls(): Promise<RecentVapiCall[]> {
  if (!vapiConfigured()) return [];
  try {
    const list = (await vapi("/call?limit=100")) as Array<{
      id: string;
      status?: string;
      type?: string;
      assistantId?: string;
      assistant?: { id?: string };
      customer?: { number?: string };
      startedAt?: string;
      endedAt?: string;
      endedReason?: string;
      analysis?: { summary?: string };
      summary?: string;
    }>;
    return (Array.isArray(list) ? list : [])
      .filter((c) => c.status === "ended" || c.endedAt)
      .map((c) => ({
        id: c.id,
        assistantId: c.assistantId ?? c.assistant?.id,
        direction: (c.type ?? "").toLowerCase().includes("outbound") ? "outbound" : "inbound",
        customerNumber: c.customer?.number,
        startedAt: c.startedAt,
        endedAt: c.endedAt,
        endedReason: c.endedReason,
        summary: c.analysis?.summary ?? c.summary,
      }));
  } catch (e) {
    console.error("listRecentVapiCalls failed:", e);
    return [];
  }
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

  // A webhook/custom tool is only usable if it points at a REAL reachable
  // https URL. Placeholder URLs (example.com, localhost, empty) get skipped
  // so they never 405 mid-call — the agent falls back to the built-in
  // booking tools, which store into our own Calendar + Contacts.
  const skippedPlaceholderTools: string[] = [];
  const isRealUrl = (url?: string): boolean => {
    if (!url || !/^https:\/\/.+/i.test(url)) return false;
    return !/(^https?:\/\/)?(www\.)?(example\.(com|org|net)|localhost|127\.0\.0\.1|your-)/i.test(url);
  };

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
        if (!isRealUrl(cfg.serverUrl)) {
          if (cfg.serverUrl) skippedPlaceholderTools.push(t.name);
          break;
        }
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
        if (!isRealUrl(cfg.serverUrl)) {
          if (cfg.serverUrl) skippedPlaceholderTools.push(t.name);
          break;
        }
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
        if (!isRealUrl(cfg.zapierUrl)) {
          if (cfg.zapierUrl) skippedPlaceholderTools.push(t.name);
          break;
        }
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
      case "end_call": {
        // Vapi's built-in hang-up capability, as a real tool so it shows and works.
        tools.push({ type: "endCall" });
        break;
      }
      case "transfer_call": {
        const number = cfg.phoneNumber?.trim();
        const sip = cfg.sip?.trim();
        if (number) {
          tools.push({
            type: "transferCall",
            destinations: [{ type: "number", number, message: t.aiResponse || "Please hold while I transfer you." }],
          });
        } else if (sip) {
          tools.push({
            type: "transferCall",
            destinations: [{ type: "sip", sipUri: sip.startsWith("sip:") ? sip : `sip:${sip}`, message: t.aiResponse || "Please hold while I transfer you." }],
          });
        } else {
          // A transfer tool with no destination can't work — flag it clearly.
          skippedPlaceholderTools.push(`${t.name} (no transfer destination set)`);
        }
        break;
      }
      case "knowledge_base": {
        // Real Vapi tool so the agent can look things up mid-call AND it shows
        // as an active tool. The knowledge is ALSO injected into the system
        // prompt (below), so the agent has it either way.
        if (!site) break;
        tools.push({
          type: "function",
          async: false,
          function: {
            name: "knowledge_base",
            description:
              "Search this business's knowledge base — services, prices, hours, location, policies, FAQs, and any documents or website content added for this agent. Call this whenever the caller asks a question about the business and answer from what it returns.",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "What the caller is asking about, in a few words" },
              },
              required: ["query"],
            },
          },
          server: executeServer(t.id),
        });
        break;
      }
      default:
        break;
    }
  }

  // Built-in appointment tools — every agent can identify patients and book,
  // reschedule and cancel appointments. Results land on the Calendar tab,
  // create Contacts, and sync to Google Calendar when connected.
  if (site) {
    const calServer = executeServer("builtin_calendar");
    tools.push(
      {
        type: "function",
        async: false,
        function: {
          name: "find_patient",
          description:
            "Look up an existing patient by name (and phone number if needed). Use when a caller says they are an existing patient and has given their name. Returns whether zero, one, or multiple patients match — with visit history and upcoming appointment when the match is unique.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "The patient's name as they said it" },
              phone: { type: "string", description: "The patient's phone number — only after asking for it to disambiguate multiple matches" },
            },
            required: [],
          },
        },
        server: calServer,
      },
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
              email: { type: "string", description: "The patient's email address, for the confirmation and reminders" },
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

  if (skippedPlaceholderTools.length) {
    lastSkippedTools.set(agent.id, skippedPlaceholderTools);
  } else {
    lastSkippedTools.delete(agent.id);
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

  // Standard patient-identification & booking policy, appended to every
  // agent so the conversation order is consistent: new-vs-existing first,
  // name-only lookup, phone only to disambiguate, then booking.
  const BOOKING_POLICY = `
# DATE & TIME (critical)
- The current date and time is {{"now" | date: "%A, %B %e, %Y at %l:%M %p"}}. Trust this, never guess the date.
- Resolve every relative time the caller says ("today", "tomorrow", "next Monday", "this afternoon") against that current date.
- When you call book_appointment / reschedule_appointment, ALWAYS pass an absolute ISO 8601 datetime you computed yourself, e.g. 2026-08-10T14:00:00 — never a word like "tomorrow".
- Before booking, read the exact day, date and time back to the caller and get a yes.

# PATIENT IDENTIFICATION & BOOKING POLICY (always follow)
1. NEVER ask for the caller's phone number at the start of the call. Open by helping with what they called about.
2. When the caller wants an appointment (or mentions being a patient), first ask: are they a NEW patient or an EXISTING patient?
3. EXISTING patient: ask for their NAME only, then call the find_patient tool with that name.
   - If multiple patients match, ask for their full phone number and call find_patient again with name and phone.
   - If exactly one matches, greet them back by name, mention their last visit or upcoming appointment from the tool result, and ask whether they want to continue with / change the previous appointment or book a new one.
   - If none match, say you couldn't find them and continue as a new patient.
4. NEW patient: first ask about their concern (pain, symptoms, questions) and help them. When they're ready to book, collect: full name, preferred date and time, their phone number, and their email address (for the confirmation and reminders) — ask for the email naturally as part of confirming the booking, and read it back to make sure it's correct.
5. To book, call book_appointment with the collected details. To move or cancel an existing one, use reschedule_appointment / cancel_appointment.
6. After the tool succeeds, confirm the appointment details aloud (day, date, time, doctor). If a tool returns an error, apologise briefly, do NOT claim the booking succeeded, and offer to have the clinic call them back.`;

  // Honesty / scope guardrail so the agent answers from what it actually
  // knows and never over-promises to a caller.
  const SCOPE_GUARDRAIL = `
# WHAT YOU KNOW AND WHAT YOU DON'T (always follow)
- Answer questions using ONLY the information in your knowledge base and the details in these instructions. If the knowledge base has a website or documents, rely on those facts.
- Never invent services, prices, availability, doctors, insurance details, medical advice, or policies that are not in your knowledge. If you are not sure, say you're not certain and offer to take a message or have the clinic follow up.
- You can ONLY do these things: answer questions from your knowledge, and use the tools you've been given (for example booking, rescheduling, cancelling, looking up a patient, transferring the call, or ending the call). You cannot do anything outside that.
- If a caller asks for something you cannot do (for example prescriptions, medical diagnosis, emergencies, payments over the phone, or anything not in your knowledge or tools), tell them plainly that you can't help with that specific thing, briefly list what you CAN help with, and offer to connect them to a person or take a message.
- For any medical emergency, tell the caller to hang up and call their local emergency number immediately.`;

  // Multilingual: reply in the caller's language, translating the (English)
  // knowledge on the fly. The voice + transcriber are already multilingual.
  const LANGUAGE_POLICY = `
# LANGUAGE (always follow)
- Detect the language the caller is speaking and reply in that SAME language, naturally and fluently.
- You can speak many languages — including English, Arabic, Urdu, Hindi, Sindhi, Turkish, French, Spanish, Italian and others. Your knowledge and instructions are written in English; translate the relevant facts into the caller's language when you answer. Never read English to someone speaking another language.
- If the caller switches languages mid-call, switch with them. If their language is unclear, ask once which language they prefer, then continue in it.
- Keep names, numbers, dates and times accurate when you translate.`;

  const systemPrompt =
    (knowledgeText ? `${agent.systemPrompt}\n\n${knowledgeText}` : agent.systemPrompt) +
    BOOKING_POLICY +
    SCOPE_GUARDRAIL +
    LANGUAGE_POLICY;

  // LLM + TTS + transcriber models from the agent's engine preset/overrides.
  const engine = resolveEngine(agent);

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
    // The assistant must greet first on INBOUND phone calls, otherwise the
    // caller hears silence until they speak — the "no one was speaking" bug.
    firstMessageMode: "assistant-speaks-first",
    // End Call / Transfer are attached as real tools in buildVapiTools; keep
    // forwardingPhoneNumber as a belt-and-braces fallback for transfers.
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
      // LLM comes from the agent's engine preset / override (editor).
      provider: engine.provider,
      model: engine.model,
      messages: [{ role: "system", content: systemPrompt }],
      ...(buildVapiTools(agent).length ? { tools: buildVapiTools(agent) } : {}),
    },
    voice: {
      provider: "11labs",
      // voiceId is the real ElevenLabs voice picked in the editor; the named
      // VOICE_MAP is the fallback for agents created before voice previews.
      voiceId: agent.voiceId || (VOICE_MAP[agent.voice] ?? VOICE_MAP["Nova (female, warm)"]),
      // Multilingual TTS model — the SAME voice can speak 30+ languages, so the
      // agent replies in whatever language the caller uses.
      model: engine.voiceModel,
    },
    // "multi" lets the transcriber detect and follow the caller's language
    // (and code-switching) instead of assuming English.
    transcriber: { provider: "deepgram", model: engine.transcriberModel, language: "multi" },
    // Per-assistant server URL: Vapi POSTs the end-of-call report here after
    // EVERY call (inbound phone, outbound, web) so it lands in Call Logs and
    // the dashboard charts — without relying on the account-level Server URL
    // being set in the Vapi dashboard. This is what makes real phone calls
    // show up. It always points at the CURRENT site, so changing the domain
    // just means re-syncing agents (Integrations → Re-sync agents to Vapi).
    ...(siteUrl()
      ? {
          server: {
            url: `${siteUrl()}/api/vapi/webhook`,
            ...(process.env.VAPI_WEBHOOK_SECRET
              ? { secret: process.env.VAPI_WEBHOOK_SECRET }
              : {}),
          },
          serverMessages: ["end-of-call-report"],
        }
      : {}),
    // Post-call summary/analysis, sent to our webhook.
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

  // Staged fallback: full payload → function-type tools only (named provider
  // tools like Slack/Sheets need credentials linked in the Vapi dashboard and
  // are rejected until then) → no custom tools. The assistant itself always
  // stays in sync, and the exact Vapi rejection is recorded per agent so the
  // editor can show WHY tools didn't attach.
  const model = payload.model as Record<string, unknown> & { tools?: { type?: string }[] };
  lastToolSyncError.delete(agent.id);
  const skipped = lastSkippedTools.get(agent.id);
  if (skipped?.length) {
    lastToolSyncError.set(
      agent.id,
      `These tools point at placeholder URLs (example.com…) and were skipped so they can't fail calls: ${skipped.join(", ")}. Either set a real https URL on each, or delete them and use the built-in booking (book_appointment / find_patient), which saves into your Calendar and Contacts automatically.`
    );
  }
  try {
    const id = await push(payload);
    return id;
  } catch (e) {
    if (!model.tools) throw e; // no tools involved → a real assistant error
    const fullErr = (e as Error).message;
    console.error(`Vapi rejected the full tool set for agent ${agent.id}:`, fullErr);

    // Retry with ONLY our function-type tools (booking, memory, webhooks, …),
    // dropping provider tools. Always attempt this when any function tool
    // exists — even if every tool is a function type — so a provider-tool
    // rejection or a transient error never silently kills our real tools.
    const functionTools = model.tools.filter((t) => t.type === "function");
    if (functionTools.length > 0) {
      try {
        const id = await push({ ...payload, model: { ...model, tools: functionTools } });
        if (functionTools.length < model.tools.length) {
          lastToolSyncError.set(
            agent.id,
            "Provider tools (e.g. Slack, Google Sheets) need their credentials linked in Integrations, so they were skipped. Booking, webhooks and other function tools are active."
          );
        }
        return id;
      } catch (e2) {
        const fnErr = (e2 as Error).message;
        console.error(`Vapi rejected function tools too for agent ${agent.id}:`, fnErr);
        lastToolSyncError.set(agent.id, `The system rejected the tools: ${fnErr.slice(0, 400)}`);
      }
    } else {
      lastToolSyncError.set(agent.id, `The system rejected the tools: ${fullErr.slice(0, 400)}`);
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

// Create a NATIVE Vapi outbound campaign. Vapi handles the dialing queue,
// concurrency, retries and (optional) scheduling for the whole customer list
// — the right way to run bulk outbound. Returns the Vapi campaign id.
export async function createVapiCampaign(options: {
  name: string;
  assistantId: string;
  phoneNumberId: string;
  customers: { number: string; name?: string; variableValues?: Record<string, string> }[];
  earliestAt?: string; // ISO — omit to start now
}): Promise<{ id?: string } | null> {
  if (!vapiConfigured()) return null;
  return vapi("/campaign", {
    method: "POST",
    body: JSON.stringify({
      name: options.name,
      assistantId: options.assistantId,
      phoneNumberId: options.phoneNumberId,
      customers: options.customers.map((c) => ({
        number: c.number,
        ...(c.name ? { name: c.name } : {}),
        ...(c.variableValues && Object.keys(c.variableValues).length
          ? { assistantOverrides: { variableValues: c.variableValues } }
          : {}),
      })),
      ...(options.earliestAt ? { schedulePlan: { earliestAt: options.earliestAt } } : {}),
    }),
  }) as Promise<{ id?: string }>;
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
    // Gather EVERY string in the payload that looks like a recording URL,
    // then pick a COMPLETE one. A URL is only usable if it has an audio file
    // extension or a real object key — a bare bucket prefix ending in "-"
    // (seen with HIPAA/custom R2 storage) returns HTTP 400 and must be
    // rejected, which was the "recording won't load" bug.
    const candidates: string[] = [];
    (function scan(v: unknown) {
      if (typeof v === "string") {
        if (/^https?:\/\//i.test(v) && (/\.(wav|mp3|ogg|m4a|flac|webm)/i.test(v) || /recording/i.test(v))) {
          candidates.push(v);
        }
      } else if (Array.isArray(v)) v.forEach(scan);
      else if (v && typeof v === "object") Object.values(v).forEach(scan);
    })(call);

    const looksComplete = (u: string) =>
      /\.(wav|mp3|ogg|m4a|flac|webm)(\?|$)/i.test(u) && !/\/[^/]*-$/.test(u.split("?")[0]);
    const isSigned = (u: string) => /[?&](x-amz-signature|signature|se=|sig=|token=)/i.test(u);

    // Best first: complete filename + a signature; then complete; then signed.
    const ranked = [...new Set(candidates)].sort((a, b) => {
      const score = (u: string) => (looksComplete(u) ? 2 : 0) + (isSigned(u) ? 1 : 0);
      return score(b) - score(a);
    });
    const best = ranked.find((u) => looksComplete(u)) ?? ranked.find((u) => isSigned(u)) ?? null;

    if (!best) {
      console.error(
        `No COMPLETE recording URL for Vapi call ${callId}. Candidates:`,
        JSON.stringify(candidates.slice(0, 4)),
        "— likely HIPAA/custom storage returning a bucket prefix without a signed object URL."
      );
    }
    return best;
  } catch (e) {
    console.error("Recording fetch failed:", e);
    return null;
  }
}

// Full call details from Vapi: fresh recording URL + the COMPLETE transcript
// (the browser SDK can miss late turns; Vapi's artifact.messages is
// authoritative). Used to backfill test-call logs.
export async function getCallDetails(callId: string): Promise<{
  recordingUrl: string | null;
  transcript: TranscriptTurn[];
  durationSec: number;
} | null> {
  if (!vapiConfigured()) return null;
  try {
    const call = (await vapi(`/call/${callId}`)) as {
      startedAt?: string;
      endedAt?: string;
      artifact?: {
        messages?: { role?: string; message?: string; secondsFromStart?: number }[];
      };
    };
    const transcript: TranscriptTurn[] = (call.artifact?.messages ?? [])
      .filter((m) => (m.role === "user" || m.role === "bot" || m.role === "assistant") && m.message)
      .map((m) => ({
        speaker: m.role === "user" ? ("caller" as const) : ("agent" as const),
        text: String(m.message).slice(0, 4000),
        at: Math.max(0, Math.round(Number(m.secondsFromStart) || 0)),
      }));
    const durationSec =
      call.startedAt && call.endedAt
        ? Math.max(0, Math.round((Date.parse(call.endedAt) - Date.parse(call.startedAt)) / 1000))
        : 0;
    const recordingUrl = await getCallRecording(callId);
    return { recordingUrl, transcript, durationSec };
  } catch (e) {
    console.error("Call details fetch failed:", e);
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
