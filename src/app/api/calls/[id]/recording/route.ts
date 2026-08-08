import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findCall, updateCall } from "@/lib/db";
import { getCallRecording } from "@/lib/vapi";

// Recording playback endpoint. Vapi's recording links are SIGNED storage URLs
// that expire after a while — a stored link can 401 a day later. The player
// points here instead: on every request we fetch a FRESH link from Vapi by
// call id and STREAM the audio through the server (no redirect), so playback
// keeps working regardless of link expiry, CORS, or storage auth quirks.

async function fetchAudio(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok || !res.body) return null;
    return res;
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const call = await findCall(session.userId, id);
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  // Candidate URLs: a fresh signed link from Vapi first, the stored one last.
  const candidates: string[] = [];
  if (call.vapiCallId) {
    const fresh = await getCallRecording(call.vapiCallId);
    if (fresh) {
      candidates.push(fresh);
      if (fresh !== call.recordingUrl) {
        await updateCall(session.userId, call.id, { recordingUrl: fresh }).catch(() => {});
      }
    }
  }
  if (call.recordingUrl && !candidates.includes(call.recordingUrl)) {
    candidates.push(call.recordingUrl);
  }

  for (const url of candidates) {
    const upstream = await fetchAudio(url);
    if (!upstream) continue;
    const type =
      upstream.headers.get("content-type") ??
      (url.includes(".mp3") ? "audio/mpeg" : "audio/wav");
    const headers = new Headers({
      "Content-Type": type,
      "Cache-Control": "no-store",
      "Accept-Ranges": "none",
    });
    const length = upstream.headers.get("content-length");
    if (length) headers.set("Content-Length", length);
    return new Response(upstream.body, { status: 200, headers });
  }

  return NextResponse.json(
    {
      error: call.vapiCallId
        ? "The recording isn't ready on Vapi yet — try again in a minute."
        : "No recording available for this call.",
    },
    { status: 404 }
  );
}
