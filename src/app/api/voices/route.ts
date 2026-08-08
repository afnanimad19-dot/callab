import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// Lists ElevenLabs voices (with preview audio URLs) for the agent editor's
// voice picker. Set ELEVENLABS_API_KEY in the environment. Falls back to the
// four built-in named voices when the key isn't configured.

const FALLBACK = [
  { voiceId: "21m00Tcm4TlvDq8ikWAM", name: "Nova (female, warm)", labels: "female · american", previewUrl: null },
  { voiceId: "pNInz6obpgDQGcFmaJgB", name: "Atlas (male, calm)", labels: "male · american", previewUrl: null },
  { voiceId: "EXAVITQu4vr4xnSDxMaL", name: "Sage (female, professional)", labels: "female · american", previewUrl: null },
  { voiceId: "ErXwobaYiN019PkySvjV", name: "Orion (male, energetic)", labels: "male · american", previewUrl: null },
];

// Cache per server instance — the voice list rarely changes.
let cache: { at: number; voices: unknown[] } | null = null;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key =
    process.env.ELEVENLABS_API_KEY ??
    process.env.ELEVEN_LABS_API_KEY ??
    process.env.XI_API_KEY;
  if (!key) return NextResponse.json({ voices: FALLBACK, live: false });

  if (cache && Date.now() - cache.at < 10 * 60 * 1000) {
    return NextResponse.json({ voices: cache.voices, live: true });
  }

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": key },
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
    const data = await res.json();
    const voices = (data.voices ?? []).map(
      (v: {
        voice_id: string;
        name: string;
        preview_url?: string;
        labels?: Record<string, string>;
      }) => ({
        voiceId: v.voice_id,
        name: v.name,
        labels: Object.values(v.labels ?? {}).filter(Boolean).join(" · "),
        previewUrl: v.preview_url ?? null,
      })
    );
    cache = { at: Date.now(), voices };
    return NextResponse.json({ voices, live: true });
  } catch (e) {
    console.error("ElevenLabs voices fetch failed:", e);
    return NextResponse.json({ voices: FALLBACK, live: false });
  }
}
