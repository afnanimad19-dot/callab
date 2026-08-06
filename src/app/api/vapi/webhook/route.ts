// Vapi server webhook — real calls flow into the dashboard through here.
//
// In the Vapi dashboard, set your Server URL to:
//     https://<your-site>/api/vapi/webhook
// and set a Server Secret; put the same value in VAPI_WEBHOOK_SECRET so we
// can verify events really come from Vapi.
//
// On "end-of-call-report" we map the finished call to our Call shape and
// write it to the calls table, so it appears in Call Logs and the dashboard
// charts. Other message types are acknowledged and ignored for now.

import { NextResponse } from "next/server";
import { findAgentByVapiAssistantId, insertCalls } from "@/lib/db";
import { getAssistantId, mapEndOfCallReport } from "@/lib/vapi";

export async function POST(request: Request) {
  // Verify the shared secret when one is configured.
  const expected = process.env.VAPI_WEBHOOK_SECRET;
  if (expected) {
    const provided =
      request.headers.get("x-vapi-secret") ??
      request.headers.get("x-vapi-signature");
    if (provided !== expected) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const body = await request.json().catch(() => null);
  const message = body?.message;
  if (!message?.type) {
    return NextResponse.json({ ok: true, ignored: "no message type" });
  }

  if (message.type !== "end-of-call-report") {
    // status-update, transcript, hang, etc. — acknowledge without storing.
    return NextResponse.json({ ok: true, type: message.type });
  }

  const assistantId = getAssistantId(message);
  if (!assistantId) {
    return NextResponse.json({ ok: true, note: "no assistant id on report" });
  }

  const agent = await findAgentByVapiAssistantId(assistantId);
  if (!agent) {
    // The call came from an assistant we don't have on file (e.g. created
    // directly in Vapi). Acknowledge so Vapi doesn't retry indefinitely.
    return NextResponse.json({ ok: true, note: "unknown assistant" });
  }

  try {
    const call = mapEndOfCallReport(message, agent);
    await insertCalls([call]);
    return NextResponse.json({ ok: true, callId: call.id });
  } catch (e) {
    console.error("Failed to store Vapi call:", e);
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
