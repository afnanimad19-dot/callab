import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findCall, updateCall } from "@/lib/db";
import { getCallRecording } from "@/lib/vapi";

// Recording playback endpoint. Vapi's recording links are SIGNED storage URLs
// that expire after a while — a stored link can 401 a day later. The player
// points here instead: on every request we fetch a FRESH link from Vapi by
// call id and STREAM the audio through the server (no redirect), so playback
// keeps working regardless of link expiry, CORS, or storage auth quirks.
// Append ?debug=1 to see exactly which URLs were tried and why they failed.

async function fetchAudio(url: string): Promise<{ res: Response | null; status: string }> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok || !res.body) {
      return { res: null, status: `HTTP ${res.status}` };
    }
    return { res, status: "ok" };
  } catch (e) {
    return { res: null, status: (e as Error).message.slice(0, 120) };
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const debug = new URL(request.url).searchParams.get("debug") === "1";
  const call = await findCall(session.userId, id);
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  // Candidate URLs: a fresh signed link from Vapi first (retry once — the
  // artifact can lag a few seconds after the call ends), the stored one last.
  const candidates: string[] = [];
  let vapiLookup = "no vapiCallId on this call";
  if (call.vapiCallId) {
    let fresh = await getCallRecording(call.vapiCallId);
    if (!fresh) {
      await new Promise((r) => setTimeout(r, 1500));
      fresh = await getCallRecording(call.vapiCallId);
    }
    vapiLookup = fresh ? "found fresh URL" : "Vapi returned no recording URL (see server logs)";
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

  const attempts: { url: string; status: string }[] = [];
  for (const url of candidates) {
    const { res: upstream, status } = await fetchAudio(url);
    attempts.push({ url: url.slice(0, 120), status });
    if (!upstream) continue;
    if (debug) {
      return NextResponse.json({
        ok: true, vapiCallId: call.vapiCallId ?? null, vapiLookup, attempts,
        contentType: upstream.headers.get("content-type"),
        contentLength: upstream.headers.get("content-length"),
      });
    }
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

  console.error("Recording unavailable:", { callId: id, vapiCallId: call.vapiCallId, vapiLookup, attempts });
  return NextResponse.json(
    {
      error: call.vapiCallId
        ? "The recording isn't ready on Vapi yet — try again in a minute."
        : "No recording available for this call.",
      vapiCallId: call.vapiCallId ?? null,
      vapiLookup,
      attempts,
    },
    { status: 404 }
  );
}
