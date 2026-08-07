import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// The Vapi PUBLIC key is safe to expose to the browser — it only lets the
// web SDK start calls against your assistants. The private key never leaves
// the server. Set VAPI_PUBLIC_KEY in the environment to enable voice testing.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    publicKey: process.env.VAPI_PUBLIC_KEY ?? null,
  });
}
