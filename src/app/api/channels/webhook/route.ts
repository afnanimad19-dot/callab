import { NextResponse } from "next/server";
import crypto from "crypto";
import { findUserByChannelId, listChatMessages, saveChannelSettings } from "@/lib/db";
import {
  generateAgentReply, recordMessage, sendChannelText, upsertConversation,
} from "@/lib/channels";

// Optional: confirm the POST really came from Meta using the app secret.
// Only enforced when META_APP_SECRET is set — otherwise skipped, so existing
// setups keep working. Meta signs the raw body as sha256=<hmac>.
function signatureValid(rawBody: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return true; // not configured → don't block
  if (!header) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

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
  // Read the raw body so the signature (computed over raw bytes) can be checked.
  const raw = await request.text();
  if (!signatureValid(raw, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = null;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }
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
          // Debug stamp: prove Meta actually reached us (visible in diagnostics).
          const msgCount = (value.messages ?? []).length;
          await saveChannelSettings(settings.userId, {
            lastWebhookAt: new Date().toISOString(),
            lastWebhookInfo: `whatsapp ${msgCount ? `${msgCount} message(s)` : value.statuses ? "status update" : "event"} for ${phoneNumberId}`,
          }).catch(() => {});
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
            await handleInbound(settings.userId, settings, "whatsapp", msg.from, profileName, `+${msg.from}`, text, msg.id);
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
          await handleInbound(settings.userId, settings, channel, senderId, "", undefined, text, event.message?.mid);
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
  text: string,
  externalMsgId?: string
) {
  const conversation = await upsertConversation(userId, channel, externalId, customerName, customerPhone);

  // De-duplicate provider retries: if this exact message id is already logged,
  // it's a retry (Meta resends when a webhook is slow) — skip so we don't reply twice.
  if (externalMsgId) {
    const already = (await listChatMessages(userId)).some(
      (m) => m.conversationId === conversation.id && m.externalMsgId === externalMsgId
    );
    if (already) return;
  }

  await recordMessage(conversation, "in", "customer", text, "text", externalMsgId);

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
