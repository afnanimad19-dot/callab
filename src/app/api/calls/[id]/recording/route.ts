import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findCall, updateCall } from "@/lib/db";
import { getCallRecording } from "@/lib/vapi";

// Recording playback endpoint. Vapi's recording links are SIGNED storage URLs
// that expire after a while — a stored link can 401 a day later. The player
// points here instead: on every request we fetch a FRESH link from Vapi by
// call id and redirect to it, so playback keeps working indefinitely.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const call = await findCall(session.userId, id);
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  const absolute = (url: string) => new URL(url, request.url);

  if (call.vapiCallId) {
    const fresh = await getCallRecording(call.vapiCallId);
    if (fresh) {
      if (fresh !== call.recordingUrl) {
        await updateCall(session.userId, call.id, { recordingUrl: fresh }).catch(() => {});
      }
      return NextResponse.redirect(absolute(fresh));
    }
  }
  if (call.recordingUrl) {
    return NextResponse.redirect(absolute(call.recordingUrl));
  }
  return NextResponse.json({ error: "No recording available for this call." }, { status: 404 });
}
