import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getChannelSettings, listAgents } from "@/lib/db";

// WhatsApp readiness check. Open while logged in:
//   /api/channels/diagnostics
// It reports exactly what the app has saved and what's still missing, so a
// "message got no reply" can be traced without reading server logs.
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await getChannelSettings(session.userId);
  const agents = await listAgents(session.userId);
  const wa = settings.whatsapp;
  const defaultAgent = agents.find((a) => a.id === settings.defaultChatAgentId);

  const origin = new URL(request.url).origin;
  const issues: string[] = [];

  if (!wa?.phoneNumberId) issues.push("No WhatsApp Phone Number ID saved in Channel settings.");
  if (!wa?.accessToken) issues.push("No WhatsApp access token saved in Channel settings.");
  if (!settings.aiAutoReply) issues.push("AI auto-reply master toggle is OFF — turn it on in the Inbox/Agent Hub.");
  if (!settings.defaultChatAgentId) issues.push("No default chat agent selected in Agent Hub.");
  else if (!defaultAgent) issues.push("The selected default chat agent no longer exists — pick one again.");
  if (!process.env.META_VERIFY_TOKEN) issues.push("META_VERIFY_TOKEN is not set on the server.");

  return NextResponse.json({
    readyToReply: issues.length === 0,
    issues,
    whatsapp: {
      connected: Boolean(wa?.connected),
      savedPhoneNumberId: wa?.phoneNumberId || null,
      savedDisplayNumber: wa?.displayNumber || null,
      savedWabaId: wa?.wabaId || null,
      hasAccessToken: Boolean(wa?.accessToken),
    },
    aiAutoReply: settings.aiAutoReply,
    defaultChatAgent: defaultAgent ? defaultAgent.name : null,
    // If this timestamp is recent (right after you messaged the number), Meta
    // IS reaching the webhook — so any "no reply" is on our side. If it stays
    // empty/old after you message, Meta is NOT delivering (a Meta-side setup
    // problem: recipient not added, number not subscribed, or app not live).
    lastWebhookAt: settings.lastWebhookAt ?? null,
    lastWebhookInfo: settings.lastWebhookInfo ?? null,
    // Compare this Phone Number ID to the one in Meta → API Setup. They MUST match.
    checkThis: "The 'savedPhoneNumberId' above must exactly equal the Phone number ID shown in Meta → WhatsApp → API Setup.",
    webhookUrlForMeta: `${origin}/api/channels/webhook`,
    verifyTokenSet: Boolean(process.env.META_VERIFY_TOKEN),
  });
}
