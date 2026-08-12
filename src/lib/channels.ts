// Omnichannel plumbing: sending messages out through Meta's Graph API
// (WhatsApp Cloud API, Messenger, Instagram DM) and generating AI replies
// with the workspace's Agent Hub agent.

import {
  ChannelSettings, ChatMessage, Conversation, createChatMessage,
  createConversation, findAgentAnyUser, listChatMessages, listConversations, newId,
  updateConversation,
} from "./db";
import { ensureContact } from "./appointments";
import { chatWithAssistant, vapiConfigured } from "./vapi";
import { buildKnowledgeText } from "./knowledge";
import { chatComplete, type ChatMsg } from "./llm";

// A chat session is considered "closed" after this much silence; the next
// message then offers a resume menu instead of continuing blindly.
const SESSION_TIMEOUT_MINUTES = 15;

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
  // PRIMARY: the assistant's own chat thread — it already carries the full
  // agent brain, knowledge and tools. previousChatId keeps context between
  // messages (without it, every message restarts and repeats the greeting).
  if (vapiConfigured() && agent.vapiAssistantId) {
    try {
      const result = await chatWithAssistant({
        assistantId: agent.vapiAssistantId,
        input,
        previousChatId: conversation.vapiChatId,
      });
      if (result?.reply && result.reply !== "(no reply)") {
        if (result.chatId && result.chatId !== conversation.vapiChatId) {
          await updateConversation(conversation.userId, conversation.id, {
            vapiChatId: result.chatId,
            lastReplyError: undefined,
          }).catch(() => {});
        }
        return { reply: result.reply, agentName };
      }
    } catch (e) {
      const err = (e as Error).message.slice(0, 200);
      await updateConversation(conversation.userId, conversation.id, { lastReplyError: `chat: ${err}` }).catch(() => {});
      console.error("Assistant chat reply failed:", e);
    }
  }

  // SECONDARY: our own LLM with the agent's brain + history (needs OPENROUTER_API_KEY).
  const history = (await listChatMessages(conversation.userId))
    .filter((m) => m.conversationId === conversation.id)
    .filter((m) => !conversation.sessionStartAt || m.at >= conversation.sessionStartAt)
    .filter((m) => m.kind === "text" || m.kind === undefined)
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-20);
  const messages: ChatMsg[] = [{ role: "system", content: await buildChatSystemPrompt(agent) }];
  for (const m of history) messages.push({ role: m.direction === "in" ? "user" : "assistant", content: m.text });
  if (history[history.length - 1]?.text !== input) messages.push({ role: "user", content: input });

  const reply = await chatComplete(messages, { temperature: 0.5, maxTokens: 500 });
  if (reply) return { reply, agentName };

  await updateConversation(conversation.userId, conversation.id, {
    lastReplyError: "No AI backend available — set OPENROUTER_API_KEY or check the voice-system key.",
  }).catch(() => {});
  return { reply: "Thanks for your message — someone from our team will get back to you shortly.", agentName };
}
