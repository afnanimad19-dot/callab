// Omnichannel plumbing: sending messages out through Meta's Graph API
// (WhatsApp Cloud API, Messenger, Instagram DM) and generating AI replies
// with the workspace's Agent Hub agent.

import {
  ChannelSettings, ChatMessage, Conversation, createChatMessage,
  createConversation, findAgentAnyUser, listConversations, newId,
  updateConversation,
} from "./db";
import { ensureContact } from "./appointments";
import { chatWithAssistant, vapiConfigured } from "./vapi";

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
  kind: ChatMessage["kind"] = "text"
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
  });
  await updateConversation(conversation.userId, conversation.id, {
    lastMessageAt: msg.at,
    lastMessageText: kind === "audio" ? "Voice message" : text.slice(0, 120),
    unread: direction === "in" ? (conversation.unread ?? 0) + 1 : 0,
  });
  return msg;
}

// --- AI auto-reply (Agent Hub) ----------------------------------------------

export async function generateAgentReply(
  conversation: Conversation,
  settings: ChannelSettings,
  input: string
): Promise<{ reply: string; agentName: string } | null> {
  const agentId = conversation.agentId || settings.defaultChatAgentId;
  if (!agentId) return null;
  const agent = await findAgentAnyUser(agentId);
  if (!agent || agent.userId !== conversation.userId) return null;

  if (vapiConfigured() && agent.vapiAssistantId) {
    try {
      const result = await chatWithAssistant({ assistantId: agent.vapiAssistantId, input });
      if (result) return { reply: result.reply, agentName: agent.name };
    } catch (e) {
      console.error("Agent chat reply failed:", e);
    }
  }
  // Demo-mode fallback so the inbox works before Vapi is configured.
  return {
    reply: agent.greeting || `Hi! This is ${agent.name}. How can I help you today?`,
    agentName: agent.name,
  };
}
