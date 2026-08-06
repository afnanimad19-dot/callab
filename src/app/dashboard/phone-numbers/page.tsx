import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listPhoneNumbers } from "@/lib/db";

export const metadata = { title: "Phone Numbers — VoiceLine AI" };

export default async function PhoneNumbersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const numbers = await listPhoneNumbers(session.userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Phone Numbers</h1>
        <p className="mt-1 text-sm text-ink-400">
          Numbers your agents answer and dial from. Provision real numbers
          through the Vapi integration once connected.
        </p>
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="px-5 py-3 font-medium">Number</th>
              <th className="px-5 py-3 font-medium">Provider</th>
              <th className="px-5 py-3 font-medium">Assigned agent</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700/70">
            {numbers.map((n) => (
              <tr key={n.id}>
                <td className="px-5 py-3 font-mono text-[13px]">{n.number}</td>
                <td className="px-5 py-3 text-ink-300">{n.provider}</td>
                <td className="px-5 py-3">{n.agentName || "—"}</td>
                <td className="px-5 py-3">
                  <span className={n.status === "active" ? "badge-ok" : "badge-muted"}>
                    {n.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {numbers.length === 0 && (
          <p className="px-5 py-8 text-sm text-ink-400">No phone numbers yet.</p>
        )}
      </div>
    </div>
  );
}
