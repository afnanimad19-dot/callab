import { NextResponse } from "next/server";
import {
  storeMode,
  listAgents,
  createContact,
  deleteContact,
  newId,
} from "@/lib/db";

// Diagnostic endpoint — visit /api/health on the deployed site.
// Reports which storage backend is active, whether reads AND writes work
// (the write probe catches using the anon key instead of service_role), and
// exactly which Vapi keys are present — WITHOUT exposing any key values.

export async function GET() {
  const health: {
    storeMode: string;
    supabaseUrlSet: boolean;
    serviceKeySet: boolean;
    vapi: {
      configured: boolean;
      privateKeySet: boolean;
      publicKeySet: boolean;
      webhookSecretSet: boolean;
    };
    read: { ok: boolean; error?: string };
    write: { ok: boolean; error?: string };
  } = {
    storeMode,
    supabaseUrlSet: Boolean(process.env.SUPABASE_URL),
    serviceKeySet: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    vapi: {
      configured: Boolean(process.env.VAPI_API_KEY),
      privateKeySet: Boolean(process.env.VAPI_API_KEY),
      publicKeySet: Boolean(process.env.VAPI_PUBLIC_KEY),
      webhookSecretSet: Boolean(process.env.VAPI_WEBHOOK_SECRET),
    },
    read: { ok: false },
    write: { ok: false },
  };

  try {
    await listAgents("__health_probe__");
    health.read.ok = true;
  } catch (e) {
    health.read = { ok: false, error: (e as Error).message };
  }

  // Write probe: insert a throwaway row and then remove it, so the check
  // leaves no residue behind.
  const probeId = newId("probe");
  try {
    await createContact({
      id: probeId,
      userId: "__health_probe__",
      name: "health probe",
      phone: "+0",
      tag: "probe",
      createdAt: new Date().toISOString(),
    });
    health.write.ok = true;
    await deleteContact(probeId).catch(() => {});
  } catch (e) {
    health.write = { ok: false, error: (e as Error).message };
  }

  const ok = health.read.ok && health.write.ok;
  return NextResponse.json(health, { status: ok ? 200 : 500 });
}
