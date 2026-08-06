import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { vapiConfigured } from "@/lib/vapi";

export const metadata = { title: "Integrations — VoiceLine AI" };

export default async function IntegrationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabaseOn = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const vapiOn = vapiConfigured();

  const integrations = [
    {
      name: "Vapi",
      detail:
        "Voice pipeline: telephony, speech-to-text, LLM, and text-to-speech. Powers real inbound calls and outbound campaigns.",
      connected: vapiOn,
      hint: "Set VAPI_API_KEY in your Netlify environment variables.",
    },
    {
      name: "Supabase",
      detail:
        "Production database for accounts, agents, calls, campaigns, and contacts.",
      connected: supabaseOn,
      hint: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Netlify, and run supabase/schema.sql once.",
    },
    {
      name: "Google Calendar",
      detail: "Real appointment booking during calls.",
      connected: false,
      hint: "Planned — Phase 5 of the roadmap.",
    },
    {
      name: "CRM (HubSpot / Salesforce)",
      detail: "Sync leads and call outcomes automatically after every call.",
      connected: false,
      hint: "Planned — Phase 5 of the roadmap.",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="mt-1 text-sm text-ink-400">
          Connections status is read from your environment variables — no keys
          are ever stored in the database.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {integrations.map((i) => (
          <div key={i.name} className="card">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold">{i.name}</h2>
              <span className={i.connected ? "badge-ok" : "badge-muted"}>
                {i.connected ? "Connected" : "Not connected"}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink-300">{i.detail}</p>
            {!i.connected && (
              <p className="mt-3 rounded-lg bg-ink-800 px-3 py-2 font-mono text-xs text-ink-300">
                {i.hint}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
