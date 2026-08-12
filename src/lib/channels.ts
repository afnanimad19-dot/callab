// Omnichannel plumbing: sending messages out through Meta's Graph API
// (WhatsApp Cloud API, Messenger, Instagram DM) and generating AI replies
// with the workspace's Agent Hub agent.

import {
  ChannelSettings, ChatMessage, Conversation, createChatMessage,
  createConversation, findAgentAnyUser, listChatMessages, listContacts, listConversations, newId,
  updateConversation,
} from "./db";
import { bookAppointment, ensureContact, findUpcomingAppointment } from "./appointments";
import { chatWithAssistant, vapiConfigured } from "./vapi";
import { buildKnowledgeText } from "./knowledge";
import { chatComplete, lastLLMError, type ChatMsg } from "./llm";
import { resolveWhen } from "./datetime";

// After this much silence the chat is treated as closed; the NEXT message then
// offers the resume menu (continue / new / info) instead of replying blindly.
const SESSION_TIMEOUT_MINUTES = 3;

const GRAPH = "https://graph.facebook.com/v21.0";

// --- Outbound sends ----------------------------------------------------------

export async function sendChannelText(
  settings: ChannelSettings,
  conversation: Conversation,
  text: string
): Promise<boolean> {
  try {
    if (conversation.channel === "whatsapp" && settings.whatsapp?.accessToken) {
      const res = await fetch(`${GRAPH}/${settings.whatsapp.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.whatsapp.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: conversation.externalId,
          type: "text",
          text: { body: text },
        }),
      });
      return res.ok;
    }
    // Messenger + Instagram share the Send API shape (page-scoped token).
    const cfg = conversation.channel === "messenger" ? settings.messenger : settings.instagram;
    if (cfg?.accessToken) {
      const res = await fetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(cfg.accessToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: conversation.externalId },
          message: { text },
        }),
      });
      return res.ok;
    }
  } catch (e) {
    console.error("Channel send failed:", e);
  }
  return false;
}

// WhatsApp voice note: upload the audio then send it as an audio message.
export async function sendWhatsAppAudio(
  settings: ChannelSettings,
  conversation: Conversation,
  audio: Buffer,
  mimeType: string
): Promise<boolean> {
  const wa = settings.whatsapp;
  if (!wa?.accessToken || conversation.channel !== "whatsapp") return false;
  try {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", mimeType);
    form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), "voice-note.ogg");
    const up = await fetch(`${GRAPH}/${wa.phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${wa.accessToken}` },
      body: form,
    });
    if (!up.ok) return false;
    const { id: mediaId } = (await up.json()) as { id?: string };
    if (!mediaId) return false;
    const res = await fetch(`${GRAPH}/${wa.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${wa.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: conversation.externalId,
        type: "audio",
        audio: { id: mediaId },
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("WhatsApp audio send failed:", e);
    return false;
  }
}

// --- Conversations -----------------------------------------------------------

export async function upsertConversation(
  userId: string,
  channel: Conversation["channel"],
  externalId: string,
  customerName: string,
  customerPhone?: string
): Promise<Conversation> {
  const all = await listConversations(userId);
  const existing = all.find((c) => c.channel === channel && c.externalId === externalId);
  if (existing) return existing;
  const contactId = await ensureContact(userId, customerName || externalId, customerPhone);
  return createConversation({
    id: newId("cnv"),
    userId,
    channel,
    externalId,
    customerName: customerName || externalId,
    customerPhone,
    contactId,
    aiEnabled: true,
    lastMessageAt: new Date().toISOString(),
    unread: 0,
    createdAt: new Date().toISOString(),
  });
}

export async function recordMessage(
  conversation: Conversation,
  direction: ChatMessage["direction"],
  from: ChatMessage["from"],
  text: string,
  kind: ChatMessage["kind"] = "text",
  externalMsgId?: string
): Promise<ChatMessage> {
  const msg = await createChatMessage({
    id: newId("msg"),
    userId: conversation.userId,
    conversationId: conversation.id,
    direction,
    from,
    kind,
    text,
    at: new Date().toISOString(),
    ...(externalMsgId ? { externalMsgId } : {}),
  });
  await updateConversation(conversation.userId, conversation.id, {
    lastMessageAt: msg.at,
    lastMessageText: kind === "audio" ? "Voice message" : text.slice(0, 120),
    unread: direction === "in" ? (conversation.unread ?? 0) + 1 : 0,
  });
  return msg;
}

// --- AI auto-reply (Agent Hub) ----------------------------------------------

// Build the text-chat system prompt from the SAME brain as the voice agent
// (identity + tasks + guardrails + knowledge), adapted for short chat replies.
async function buildChatSystemPrompt(
  agent: NonNullable<Awaited<ReturnType<typeof findAgentAnyUser>>>
): Promise<string> {
  const knowledge = await buildKnowledgeText(agent.userId, agent.knowledgeBaseIds).catch(() => "");
  const brain = agent.systemPrompt || [agent.identity, agent.tasks, agent.guardrails].filter(Boolean).join("\n\n");
  return [
    brain,
    knowledge ? `# KNOWLEDGE\n${knowledge}` : "",
    `# CHAT FORMAT (always follow)
- You are replying over TEXT CHAT (WhatsApp / Instagram / Messenger), not a phone call. Everything about your identity, tasks, and knowledge above still applies.
- Keep replies short and natural, like a real chat message (usually 1-3 sentences). No markdown headings, no reading things "aloud".
- Only greet at the very start of a conversation — do NOT repeat your greeting on every message. Answer what the customer actually said and move the conversation forward.
- Reply in the same language the customer is writing in.
- Answer only from your knowledge and tasks; if you don't know, say so and offer to have the clinic follow up. Never invent prices, services, or medical advice.`,
  ].filter(Boolean).join("\n\n");
}

async function findPatientText(userId: string, name?: string, phone?: string): Promise<string> {
  const nm = String(name ?? "").trim();
  const ph = String(phone ?? "").trim();
  if (!nm && !ph) return "Ask for the patient's name first, then look up again.";
  const contacts = await listContacts(userId);
  const q = nm.toLowerCase();
  let matches = nm
    ? contacts.filter((c) => {
        const f = c.name.toLowerCase();
        return f === q || f.includes(q) || q.includes(f.split(" ")[0]);
      })
    : contacts;
  const digits = ph.replace(/[^\d]/g, "").slice(-9);
  if (digits.length >= 7) {
    const byPhone = matches.filter((c) => c.phone.replace(/[^\d]/g, "").slice(-9) === digits);
    if (byPhone.length) matches = byPhone;
  }
  if (matches.length === 0) return `No existing patient named "${nm}" found — treat them as a NEW patient (don't mention records).`;
  if (matches.length > 1) return `${matches.length} patients match "${nm}". Ask for their full phone number, then look up again.`;
  const c = matches[0];
  const upcoming = await findUpcomingAppointment(userId, c.name, c.phone);
  return (
    `Found ${c.name}${c.phone ? ` (${c.phone})` : ""}.` +
    (c.metadata?.email ? ` Email ${c.metadata.email}.` : "") +
    (upcoming
      ? ` Upcoming appointment: ${new Date(upcoming.startsAt).toLocaleString()}${upcoming.doctor ? ` with ${upcoming.doctor}` : ""}.`
      : " No upcoming appointment on file.")
  );
}

async function executeChatTool(
  userId: string,
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  try {
    if (name === "find_patient") {
      return await findPatientText(userId, String(args.name ?? ""), String(args.phone ?? ""));
    }
    if (name === "book_appointment") {
      const patientName = String(args.patient_name ?? args.name ?? "").trim();
      if (!patientName) return "ERROR: need the patient's full name before booking.";
      const when = resolveWhen(String(args.datetime ?? ""));
      if (!when) return "ERROR: the date/time wasn't understood. Ask the patient for a specific day and time, then book again.";
      const apt = await bookAppointment(userId, {
        patientName,
        phone: String(args.phone ?? "").trim() || undefined,
        email: String(args.email ?? "").trim() || undefined,
        doctor: String(args.doctor ?? "").trim() || undefined,
        service: String(args.service ?? "").trim() || undefined,
        startsAt: when,
        notes: String(args.notes ?? "").trim() || undefined,
        source: "chat",
      });
      return `SUCCESS: appointment booked for ${apt.patientName} on ${new Date(apt.startsAt).toLocaleString()}${apt.doctor ? ` with ${apt.doctor}` : ""}. Send ONE confirmation message with these exact details.`;
    }
    return "Unknown tool.";
  } catch (e) {
    return `ERROR: ${(e as Error).message.slice(0, 120)}`;
  }
}

// Run the chat agent with the agent's full brain + booking, using a TEXT
// command protocol (not native tool-calling) so it works even on free models
// that don't support function calling. The model emits a [[FIND]] / [[BOOK]]
// line; we execute it, feed the result back, and it writes the reply.
function stripCommands(text: string): string {
  return text.replace(/\[\[(BOOK|FIND)\]\][^\n]*/gi, "").replace(/\n{3,}/g, "\n\n").trim();
}

async function runChatAgent(
  agent: NonNullable<Awaited<ReturnType<typeof findAgentAnyUser>>>,
  history: ChatMessage[],
  input: string
): Promise<string | null> {
  const nowStr = new Date().toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  const system =
    (await buildChatSystemPrompt(agent)) +
    `\n\n# CURRENT DATE & TIME\nRight now it is ${nowStr}. Resolve "today", "tomorrow" and weekdays against this into a real date.` +
    `\n\n# CHAT BOOKING BEHAVIOUR (always follow)
- Have a real, caring conversation first — like an experienced clinic front desk. If the patient mentions a symptom (e.g. tooth pain), ask natural follow-up questions (where exactly, what kind of pain — sharp, throbbing, sensitivity to hot/cold, swelling, a visible cavity, how long it has lasted). Give brief helpful guidance from your knowledge.
- NEVER end or close the chat yourself. Keep helping until the patient stops replying.
- When it feels right, ask simply: "Are you ready to book an appointment?" If yes, collect — one at a time — their full name, phone number, and email.
- Recommend the most suitable doctor from your knowledge (say which doctor and why they fit) when asked or when booking.
- Before booking, read back a short summary (name, date & time, doctor, phone, email) and ask them to confirm or change anything.` +
    `\n\n# ACTIONS (internal — the patient never sees these lines)
- To look up an existing patient, reply with ONLY this one line: [[FIND]] {"name":"...","phone":"..."}
- To BOOK (only AFTER the patient confirmed the summary), reply with ONLY this one line: [[BOOK]] {"patient_name":"...","phone":"...","email":"...","doctor":"...","service":"...","datetime":"...","notes":"..."}
  datetime must be an absolute date & time you computed, e.g. 2026-08-13T15:00.
- When you output an action line, output ONLY that line and nothing else. I will run it and give you the RESULT; then you write the natural message to the patient. Never show the patient a [[FIND]]/[[BOOK]] line or raw JSON, and never claim an appointment is booked unless a RESULT said SUCCESS.`;

  const messages: ChatMsg[] = [{ role: "system", content: system }];
  for (const m of history) messages.push({ role: m.direction === "in" ? "user" : "assistant", content: m.text });
  if (history[history.length - 1]?.text !== input) messages.push({ role: "user", content: input });

  for (let round = 0; round < 4; round++) {
    const text = await chatComplete(messages, { temperature: 0.5, maxTokens: 600 });
    if (!text) return null;
    const book = text.match(/\[\[BOOK\]\]\s*(\{[\s\S]*?\})/i);
    const find = text.match(/\[\[FIND\]\]\s*(\{[\s\S]*?\})/i);
    const action = book ?? find;
    if (action) {
      let a: Record<string, unknown> = {};
      try { a = JSON.parse(action[1]); } catch { /* ignore */ }
      const result = await executeChatTool(agent.userId, book ? "book_appointment" : "find_patient", a);
      messages.push({ role: "assistant", content: text });
      messages.push({ role: "user", content: `ACTION RESULT: ${result}\n(Now write the natural message to the patient — no [[...]] lines.)` });
      continue;
    }
    return stripCommands(text) || text;
  }
  return "Let me get that sorted for you — one moment.";
}

const RESUME_MENU =
  "Welcome back! Our previous chat had gone quiet, so it's now closed. What would you like to do?\n\n" +
  "1️⃣ Continue our previous conversation\n" +
  "2️⃣ Start a new chat\n" +
  "3️⃣ Get information (doctors, services, hours)\n\n" +
  "Just reply with 1, 2, or 3.";

export async function generateAgentReply(
  conversation: Conversation,
  settings: ChannelSettings,
  input: string
): Promise<{ reply: string; agentName: string } | null> {
  const agentId = conversation.agentId || settings.defaultChatAgentId;
  if (!agentId) return null;
  const agent = await findAgentAnyUser(agentId);
  if (!agent || agent.userId !== conversation.userId) return null;
  const agentName = agent.name;

  const now = Date.now();
  const prevAt = conversation.lastMessageAt ? Date.parse(conversation.lastMessageAt) : now;
  const gapMinutes = (now - prevAt) / 60000;

  // 1) If we asked the resume menu last time, act on the customer's choice.
  if (conversation.awaitingSessionChoice) {
    await updateConversation(conversation.userId, conversation.id, { awaitingSessionChoice: false }).catch(() => {});
    const c = input.trim().toLowerCase();
    if (/^2\b|new/.test(c)) {
      await updateConversation(conversation.userId, conversation.id, {
        sessionStartAt: new Date().toISOString(),
        vapiChatId: undefined, // start a fresh assistant thread
      }).catch(() => {});
      return { reply: "No problem — starting fresh. How can I help you today?", agentName };
    }
    // choices 1 (continue) and 3 (info) both fall through to a normal reply.
  }
  // 2) Otherwise, if the session went quiet past the timeout and there's prior
  //    history, offer the resume menu instead of a blind reply.
  else if (gapMinutes > SESSION_TIMEOUT_MINUTES) {
    const prior = (await listChatMessages(conversation.userId)).filter(
      (m) => m.conversationId === conversation.id
    );
    if (prior.length > 1) {
      await updateConversation(conversation.userId, conversation.id, { awaitingSessionChoice: true }).catch(() => {});
      return { reply: RESUME_MENU, agentName };
    }
  }

  // 3) Normal reply.
  const history = (await listChatMessages(conversation.userId))
    .filter((m) => m.conversationId === conversation.id)
    .filter((m) => !conversation.sessionStartAt || m.at >= conversation.sessionStartAt)
    .filter((m) => m.kind === "text" || m.kind === undefined)
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-20);

  // PRIMARY: our own chat brain with booking tools — a real conversation that
  // can find patients and book appointments (into the Calendar, source "chat").
  try {
    const reply = await runChatAgent(agent, history, input);
    if (reply) {
      await updateConversation(conversation.userId, conversation.id, { lastReplyError: undefined }).catch(() => {});
      return { reply, agentName };
    }
    // No reply generated — record exactly why (e.g. OpenRouter rate limit).
    await updateConversation(conversation.userId, conversation.id, {
      lastReplyError: lastLLMError() || "chat model returned no reply",
    }).catch(() => {});
  } catch (e) {
    await updateConversation(conversation.userId, conversation.id, {
      lastReplyError: `chat-agent: ${(e as Error).message.slice(0, 160)}`,
    }).catch(() => {});
    console.error("Chat agent failed:", e);
  }

  const openRouterError = lastLLMError();

  // SECONDARY (reliability net): the assistant's own chat thread, which runs on
  // the voice provider (Anthropic) you already pay for — so chat still works
  // when the free OpenRouter tier is rate-limited. Keeps context via chat id.
  let vapiError = "";
  if (vapiConfigured() && agent.vapiAssistantId) {
    try {
      const result = await chatWithAssistant({
        assistantId: agent.vapiAssistantId,
        input,
        previousChatId: conversation.vapiChatId,
      });
      if (result?.reply) {
        await updateConversation(conversation.userId, conversation.id, {
          lastReplyError: undefined,
          ...(result.chatId && result.chatId !== conversation.vapiChatId ? { vapiChatId: result.chatId } : {}),
        }).catch(() => {});
        return { reply: result.reply, agentName };
      }
      vapiError = "assistant chat returned no text";
    } catch (e) {
      vapiError = (e as Error).message.slice(0, 160);
      console.error("Assistant chat reply failed:", e);
    }
  }

  // Nothing produced a reply — record the REAL reasons so diagnostics is honest.
  await updateConversation(conversation.userId, conversation.id, {
    lastReplyError:
      `OpenRouter: ${openRouterError || "no reply"}` +
      (vapiError ? ` | Vapi chat: ${vapiError}` : " | Vapi chat: not attempted"),
  }).catch(() => {});
  return { reply: "One moment — let me check on that for you.", agentName };
}
