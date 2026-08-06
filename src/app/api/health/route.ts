import { NextResponse } from "next/server";
import { storeMode, listAgents } from "@/lib/db";

// Diagnostic endpoint — visit /api/health on the deployed site.
// Reports which storage backend is active and whether it's actually
// reachable, WITHOUT ever exposing key values. Safe to leave in place.

export async function GET() {
  const supabaseUrlSet = Boolean(process.env.SUPABASE_URL);
  const serviceKeySet = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const health: {
    storeMode: string;
    supabaseUrlSet: boolean;
    serviceKeySet: boolean;
    vapiConfigured: boolean;
    read: { ok: boolean; error?: string };
  } = {
    storeMode,
    supabaseUrlSet,
    serviceKeySet,
    vapiConfigured: Boolean(process.env.VAPI_API_KEY),
    read: { ok: false },
  };

  // Exercise a real read through the active backend.
  try {
    await listAgents("__health_probe__");
    health.read.ok = true;
  } catch (e) {
    health.read = { ok: false, error: (e as Error).message };
  }

  const httpStatus = health.read.ok ? 200 : 500;
  return NextResponse.json(health, { status: httpStatus });
}
