import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getChannelSettings, listChatMessages, listConversations, updateConversation,
  listContacts, updateContact,
} from "@/lib/db";
import { generateAgentReply, recordInternalComment, recordMessage, sendChannelText } from "@/lib/channels";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const conversation = (await listConversations(session.userId)).find((c) => c.id === id);
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const messages = (await listChatMessages(session.userId))
    .filter((m) => m.conversationId === id)
    .sort((a, b) => a.at.localeCompare(b.at));
  // Opening the thread clears the unread badge.
  if (conversation.unread) await updateConversation(session.userId, id, { unread: 0 });
  const contact = conversation.contactId
    ? (await listContacts(session.userId)).find((c) => c.id === conversation.contactId) ?? null
    : null;
  return NextResponse.json({ conversation, messages, contact });
}

// Send a message into the conversation (as the human operator), or ask the
// AI agent to reply on demand ({ ai: true }).
export async function POST(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const conversation = (await listConversations(session.userId)).find((c) => c.id === id);
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const settings = await getChannelSettings(session.userId);

  if (body?.ai === true) {
    const lastCustomer = (await listChatMessages(session.userId))
      .filter((m) => m.conversationId === id && m.from === "customer")
      .sort((a, b) => b.at.localeCompare(a.at))[0];
    const generated = await generateAgentReply(conversation, settings, lastCustomer?.text ?? "Hello");
    if (!generated) {
      return NextResponse.json({ error: "Pick a default chat agent in Settings → Channels first." }, { status: 400 });
    }
    const sent = await sendChannelText(settings, conversation, generated.reply);
    const message = await recordMessage(conversation, "out", "agent", generated.reply);
    return NextResponse.json({ message, delivered: sent });
  }

  const text = String(body?.text ?? "").trim().slice(0, 4000);
  if (!text) return NextResponse.json({ error: "Message is empty." }, { status: 400 });

  // Internal team comment: stored on the thread, mentions teammates, but NEVER
  // sent to the customer's channel.
  if (body?.comment === true) {
    const message = await recordInternalComment(conversation, session.name, text);
    return NextResponse.json({ message, delivered: null, comment: true });
  }

  const sent = await sendChannelText(settings, conversation, text);
  const message = await recordMessage(conversation, "out", "human", text);
  return NextResponse.json({ message, delivered: sent });
}

// Assign to AI/human, change the agent, rename the customer.
export async function PATCH(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const conversation = (await listConversations(session.userId)).find((c) => c.id === id);
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (typeof body?.aiEnabled === "boolean") {
    patch.aiEnabled = body.aiEnabled;
    patch.assignee = body.aiEnabled ? undefined : session.name;
  }
  if (typeof body?.agentId === "string") patch.agentId = body.agentId || undefined;
  if (typeof body?.customerName === "string" && body.customerName.trim()) {
    patch.customerName = body.customerName.trim().slice(0, 120);
  }
  if (typeof body?.customerPhone === "string") {
    patch.customerPhone = body.customerPhone.trim().slice(0, 40) || undefined;
  }
  if (typeof body?.lifecycle === "string" && body.lifecycle) {
    patch.lifecycle = body.lifecycle.slice(0, 40);
  }
  const updated = await updateConversation(session.userId, id, patch);

  // Mirror name / phone / email onto the linked Contact so the two stay in sync.
  if (conversation.contactId) {
    const contactPatch: Record<string, unknown> = {};
    if (typeof body?.customerName === "string" && body.customerName.trim()) {
      contactPatch.name = body.customerName.trim().slice(0, 120);
    }
    if (typeof body?.customerPhone === "string") contactPatch.phone = body.customerPhone.trim().slice(0, 40);
    if (typeof body?.email === "string") {
      const existing = (await listContacts(session.userId)).find((c) => c.id === conversation.contactId);
      contactPatch.metadata = { ...(existing?.metadata ?? {}), email: body.email.trim().slice(0, 160) };
    }
    if (Object.keys(contactPatch).length) {
      await updateContact(session.userId, conversation.contactId, contactPatch);
    }
  }

  const contact = conversation.contactId
    ? (await listContacts(session.userId)).find((c) => c.id === conversation.contactId) ?? null
    : null;
  return NextResponse.json({ conversation: updated, contact });
}
