import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getChannelSettings, saveChannelSettings } from "@/lib/db";

const mask = (t?: string) => (t ? `${t.slice(0, 6)}…${t.slice(-4)}` : "");

// Channel connections + Agent Hub settings (Settings → Channels tab).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = await getChannelSettings(session.userId);
  return NextResponse.json({
    settings: {
      defaultChatAgentId: s.defaultChatAgentId ?? "",
      aiAutoReply: s.aiAutoReply,
      whatsapp: s.whatsapp
        ? {
            phoneNumberId: s.whatsapp.phoneNumberId,
            accessToken: mask(s.whatsapp.accessToken),
            connected: s.whatsapp.connected,
            displayNumber: s.whatsapp.displayNumber ?? "",
            wabaId: s.whatsapp.wabaId ?? "",
            pin: s.whatsapp.pin ? "••••••" : "",
          }
        : null,
      instagram: s.instagram
        ? { pageId: s.instagram.pageId, accessToken: mask(s.instagram.accessToken), connected: s.instagram.connected }
        : null,
      messenger: s.messenger
        ? { pageId: s.messenger.pageId, accessToken: mask(s.messenger.accessToken), connected: s.messenger.connected }
        : null,
      verifyToken: process.env.META_VERIFY_TOKEN ? "set" : "missing",
    },
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const current = await getChannelSettings(session.userId);

  const patch: Parameters<typeof saveChannelSettings>[1] = {};
  if (typeof body?.defaultChatAgentId === "string") patch.defaultChatAgentId = body.defaultChatAgentId.slice(0, 60);
  if (typeof body?.aiAutoReply === "boolean") patch.aiAutoReply = body.aiAutoReply;

  for (const key of ["whatsapp", "instagram", "messenger"] as const) {
    const cfg = body?.[key];
    if (cfg === null) {
      patch[key] = undefined; // disconnect
      continue;
    }
    if (cfg && typeof cfg === "object") {
      const idField = key === "whatsapp" ? String(cfg.phoneNumberId ?? "").trim() : String(cfg.pageId ?? "").trim();
      // Keep the stored token when the form sends back the masked value.
      const sentToken = String(cfg.accessToken ?? "").trim();
      const token = sentToken.includes("…") ? (current[key]?.accessToken ?? "") : sentToken;
      if (idField && token) {
        if (key === "whatsapp") {
          const sentPin = String(cfg.pin ?? "").trim();
          patch.whatsapp = {
            phoneNumberId: idField,
            accessToken: token,
            connected: true,
            displayNumber: String(cfg.displayNumber ?? "").slice(0, 30),
            wabaId: String(cfg.wabaId ?? "").slice(0, 40),
            pin: sentPin.includes("•") ? (current.whatsapp?.pin ?? "") : sentPin.slice(0, 10),
          };
        } else {
          patch[key] = { pageId: idField, accessToken: token, connected: true };
        }
      }
    }
  }

  const saved = await saveChannelSettings(session.userId, patch);
  return NextResponse.json({ ok: true, connected: {
    whatsapp: Boolean(saved.whatsapp?.connected),
    instagram: Boolean(saved.instagram?.connected),
    messenger: Boolean(saved.messenger?.connected),
  }});
}
