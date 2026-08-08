import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getChannelSettings, listConversations } from "@/lib/db";
import { recordMessage, sendWhatsAppAudio } from "@/lib/channels";

// Voice note sending (WhatsApp only — Meta's IG/Messenger Send API doesn't
// accept raw audio uploads the same way). Body: { audio: base64, mimeType }.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const conversation = (await listConversations(session.userId)).find((c) => c.id === id);
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (conversation.channel !== "whatsapp") {
    return NextResponse.json({ error: "Voice notes are supported on WhatsApp conversations." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const base64 = String(body?.audio ?? "");
  if (!base64 || base64.length > 8_000_000) {
    return NextResponse.json({ error: "Attach a voice note under ~6 MB." }, { status: 400 });
  }
  const mimeType = String(body?.mimeType ?? "audio/ogg").slice(0, 60);
  const settings = await getChannelSettings(session.userId);
  const sent = await sendWhatsAppAudio(settings, conversation, Buffer.from(base64, "base64"), mimeType);
  if (!sent) {
    return NextResponse.json({ error: "WhatsApp rejected the voice note — check the channel connection." }, { status: 502 });
  }
  const message = await recordMessage(conversation, "out", "human", "Voice message", "audio");
  return NextResponse.json({ message, delivered: true });
}
