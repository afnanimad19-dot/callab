import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { findUserById, listIntegrations } from "@/lib/db";
import { vapiConfigured } from "@/lib/vapi";
import { googleConfigured, serviceConnected, getServiceConn } from "@/lib/google";
import { sheetConfig } from "@/lib/gsheets";
import { emailConfigured, emailFrom } from "@/lib/notify";
import IntegrationsPanel from "@/components/dashboard/IntegrationsPanel";

export const metadata = { title: "Integrations — VoiceLine AI" };

export default async function IntegrationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const integrations = await listIntegrations(session.userId);
  const supabaseOn = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Internal infrastructure (the voice engine + database) that runs the
  // product. Customers should never see these — they're implementation
  // details, not integrations a customer connects. Kept here (behind a flag)
  // so operators can still check their status when SHOW_INTERNAL_INTEGRATIONS=1.
  const internalPlatforms = [
    {
      name: "Vapi",
      detail:
        "Voice pipeline: telephony, speech-to-text, LLM, and text-to-speech. Powers real inbound calls and outbound campaigns.",
      connected: vapiConfigured(),
      hint: "Set VAPI_API_KEY in your Netlify environment variables.",
    },
    {
      name: "Supabase",
      detail:
        "Production database for accounts, agents, calls, campaigns, and contacts.",
      connected: supabaseOn,
      hint: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Netlify, then run supabase/schema.sql.",
    },
    {
      name: "CRM (HubSpot / Salesforce)",
      detail: "Sync leads and call outcomes automatically after every call.",
      connected: false,
      hint: "Planned — actions phase of the roadmap.",
    },
  ];
  const platforms =
    process.env.SHOW_INTERNAL_INTEGRATIONS === "1" ? internalPlatforms : [];

  const user = await findUserById(session.userId);
  const google = {
    configured: googleConfigured(),
    calendar: {
      connected: serviceConnected(user, "calendar"),
      email: user ? getServiceConn(user, "calendar")?.email ?? null : null,
    },
    sheets: {
      connected: serviceConnected(user, "sheets"),
      email: user ? getServiceConn(user, "sheets")?.email ?? null : null,
      ...sheetConfig(user),
    },
  };
  const email = { configured: emailConfigured(), from: emailFrom() };

  return <IntegrationsPanel integrations={integrations} platforms={platforms} google={google} email={email} />;
}
