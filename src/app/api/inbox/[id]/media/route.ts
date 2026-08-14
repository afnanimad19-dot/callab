import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getChannelSettings, listConversations } from "@/lib/db";
import { recordMessage, sendWhatsAppMedia } from "@/lib/channels";

// Send a file attachment (image / video / document) on WhatsApp.
// Body: { file: base64, mimeType, filename, caption? }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const conversation = (await listConversations(session.userId)).find((c) => c.id === id);
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (conversation.channel !== "whatsapp") {
    return NextResponse.json({ error: "File attachments are supported on WhatsApp conversations." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const base64 = String(body?.file ?? "");
  if (!base64 || base64.length > 7_000_000) {
    return NextResponse.json({ error: "Attach a file under ~5 MB." }, { status: 400 });
  }
  const mimeType = String(body?.mimeType ?? "application/octet-stream").slice(0, 80);
  const filename = String(body?.filename ?? "attachment").slice(0, 120);
  const caption = String(body?.caption ?? "").slice(0, 900);

  const settings = await getChannelSettings(session.userId);
  const sent = await sendWhatsAppMedia(settings, conversation, Buffer.from(base64, "base64"), mimeType, filename, caption || undefined);
  if (!sent) {
    return NextResponse.json({ error: "WhatsApp rejected the file — check the channel connection and file type." }, { status: 502 });
  }

  const isImage = mimeType.startsWith("image/");
  // Keep a small image preview in our thread; documents just note the filename
  // (the file itself was delivered to the customer) to keep the record light.
  const previewUrl = isImage && base64.length < 2_000_000 ? `data:${mimeType};base64,${base64}` : undefined;
  const message = await recordMessage(
    conversation,
    "out",
    "human",
    caption || filename,
    isImage ? "image" : "file",
    undefined,
    previewUrl
  );
  return NextResponse.json({ message, delivered: true });
}
