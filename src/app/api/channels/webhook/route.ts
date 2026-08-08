import { NextResponse } from "next/server";
import { findUserByChannelId } from "@/lib/db";
import {
  generateAgentReply, recordMessage, sendChannelText, upsertConversation,
} from "@/lib/channels";

// Meta webhook receiver for WhatsApp Cloud API, Messenger, and Instagram DM.
// Point the app's webhook at  https://<your-site>/api/channels/webhook  and
// use META_VERIFY_TOKEN as the verify token. Incoming messages are routed to
// the right workspace by phone-number-id / page-id, logged into the Inbox,
// and answered by the Agent Hub agent when AI auto-reply is on.

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.META_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

interface WaMessage {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
  audio?: { id?: string };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.object) return NextResponse.json({ ok: true });

  try {
    // --- WhatsApp Cloud API ---
    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          const value = change.value ?? {};
          const phoneNumberId: string = value.metadata?.phone_number_id ?? "";
          const settings = phoneNumberId ? await findUserByChannelId(phoneNumberId) : null;
          if (!settings) continue;
          const contacts = value.contacts ?? [];
          for (const msg of (value.messages ?? []) as WaMessage[]) {
            if (!msg.from) continue;
            const profileName =
              contacts.find((c: { wa_id?: string; profile?: { name?: string } }) => c.wa_id === msg.from)?.profile?.name ?? "";
            const text =
              msg.type === "text"
                ? msg.text?.body ?? ""
                : msg.type === "audio"
                  ? "(voice message)"
                  : `(${msg.type ?? "message"})`;
            await handleInbound(settings.userId, settings, "whatsapp", msg.from, profileName, `+${msg.from}`, text);
          }
        }
      }
      return NextResponse.json({ ok: true });
    }

    // --- Messenger ("page") and Instagram ("instagram") ---
    if (body.object === "page" || body.object === "instagram") {
      const channel = body.object === "page" ? ("messenger" as const) : ("instagram" as const);
      for (const entry of body.entry ?? []) {
        const pageId: string = String(entry.id ?? "");
        const settings = pageId ? await findUserByChannelId(pageId) : null;
        if (!settings) continue;
        for (const event of entry.messaging ?? []) {
          const senderId: string = event.sender?.id ?? "";
          const text: string = event.message?.text ?? "";
          if (!senderId || !text || senderId === pageId) continue;
          await handleInbound(settings.userId, settings, channel, senderId, "", undefined, text);
        }
      }
      return NextResponse.json({ ok: true });
    }
  } catch (e) {
    console.error("Channel webhook error:", e);
  }
  return NextResponse.json({ ok: true });
}

async function handleInbound(
  userId: string,
  settings: NonNullable<Awaited<ReturnType<typeof findUserByChannelId>>>,
  channel: "whatsapp" | "instagram" | "messenger",
  externalId: string,
  customerName: string,
  customerPhone: string | undefined,
  text: string
) {
  const conversation = await upsertConversation(userId, channel, externalId, customerName, customerPhone);
  await recordMessage(conversation, "in", "customer", text);

  // Agent Hub auto-reply — only when the master toggle AND the conversation
  // toggle are on (a human takeover flips the conversation toggle off).
  if (settings.aiAutoReply && conversation.aiEnabled && text && !text.startsWith("(")) {
    const generated = await generateAgentReply(conversation, settings, text);
    if (generated) {
      const sent = await sendChannelText(settings, conversation, generated.reply);
      if (sent) await recordMessage(conversation, "out", "agent", generated.reply);
    }
  }
}
