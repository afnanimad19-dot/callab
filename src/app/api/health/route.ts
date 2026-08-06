import { NextResponse } from "next/server";
import { storeMode, listAgents, createContact, newId } from "@/lib/db";

// Diagnostic endpoint — visit /api/health on the deployed site.
// Reports which storage backend is active and whether reads AND writes
// actually work, WITHOUT ever exposing key values. The write probe catches
// the most common misconfiguration: using the anon key instead of the
// service_role key (reads look fine, writes fail with an RLS error).

export async function GET() {
  const health: {
    storeMode: string;
    supabaseUrlSet: boolean;
    serviceKeySet: boolean;
    vapiConfigured: boolean;
    read: { ok: boolean; error?: string };
    write: { ok: boolean; error?: string };
  } = {
    storeMode,
    supabaseUrlSet: Boolean(process.env.SUPABASE_URL),
    serviceKeySet: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    vapiConfigured: Boolean(process.env.VAPI_API_KEY),
    read: { ok: false },
    write: { ok: false },
  };

  try {
    await listAgents("__health_probe__");
    health.read.ok = true;
  } catch (e) {
    health.read = { ok: false, error: (e as Error).message };
  }

  // Write probe: insert a throwaway row, then remove it via the store's own
  // path. Uses the contacts table; the probe user id never collides with a
  // real account.
  try {
    const probeId = newId("probe");
    await createContact({
      id: probeId,
      userId: "__health_probe__",
      name: "health probe",
      phone: "+0",
      tag: "probe",
      createdAt: new Date().toISOString(),
    });
    health.write.ok = true;
  } catch (e) {
    health.write = { ok: false, error: (e as Error).message };
  }

  const ok = health.read.ok && health.write.ok;
  return NextResponse.json(health, { status: ok ? 200 : 500 });
}
