import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Settings — VoiceLine AI" };

const INTEGRATIONS = [
  {
    name: "Twilio (telephony)",
    detail: "Connect phone numbers and SIP trunks so agents can place and receive real calls.",
  },
  {
    name: "Voice AI pipeline",
    detail: "Speech-to-text, LLM, and text-to-speech providers that power the conversation.",
  },
  {
    name: "Calendar",
    detail: "Google Calendar / Outlook for real appointment booking.",
  },
  {
    name: "CRM",
    detail: "HubSpot / Salesforce sync for leads and call outcomes.",
  },
];

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-ink-400">Workspace and integrations.</p>
      </div>

      <div className="card !p-7">
        <h2 className="text-sm font-semibold">Workspace</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">Company</dt>
            <dd className="mt-1 font-medium">{session.company}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">Owner</dt>
            <dd className="mt-1 font-medium">{session.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">Email</dt>
            <dd className="mt-1 font-medium">{session.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">Plan</dt>
            <dd className="mt-1 font-medium">Developer preview</dd>
          </div>
        </dl>
      </div>

      <div className="card !p-0">
        <div className="border-b border-ink-700 px-7 py-4">
          <h2 className="text-sm font-semibold">Integrations</h2>
          <p className="mt-0.5 text-xs text-ink-400">
            These connect in Phase 2–4 of the roadmap (see README). The UI and data
            model are already built around them.
          </p>
        </div>
        <div className="divide-y divide-ink-700/70">
          {INTEGRATIONS.map((i) => (
            <div key={i.name} className="flex items-center justify-between px-7 py-4">
              <div>
                <p className="text-sm font-medium">{i.name}</p>
                <p className="text-xs text-ink-400">{i.detail}</p>
              </div>
              <span className="rounded-full bg-ink-600/40 px-3 py-1 text-xs font-medium text-ink-300">
                Not connected
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
