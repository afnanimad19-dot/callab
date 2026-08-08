import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { findUserById, listIntegrations } from "@/lib/db";
import { vapiConfigured } from "@/lib/vapi";
import { googleConfigured } from "@/lib/gcal";
import IntegrationsPanel from "@/components/dashboard/IntegrationsPanel";

export const metadata = { title: "Integrations — VoiceLine AI" };

export default async function IntegrationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const integrations = await listIntegrations(session.userId);
  const supabaseOn = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const platforms = [
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

  const user = await findUserById(session.userId);
  const google = {
    configured: googleConfigured(),
    connected: Boolean(user?.googleRefreshToken),
    email: user?.googleEmail ?? null,
  };

  return <IntegrationsPanel integrations={integrations} platforms={platforms} google={google} />;
}
