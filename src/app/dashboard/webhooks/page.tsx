import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listWebhooks } from "@/lib/db";
import QuickCreateForm from "@/components/dashboard/QuickCreateForm";

export const metadata = { title: "Webhooks — VoiceLine AI" };

export default async function WebhooksPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const webhooks = await listWebhooks(session.userId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Webhooks</h1>
          <p className="mt-1 text-sm text-ink-400">
            Get call events (call.started, call.ended, call.escalated) POSTed to
            your own systems.
          </p>
        </div>
        <QuickCreateForm
          endpoint="/api/webhooks"
          buttonLabel="+ Add endpoint"
          fields={[
            { name: "url", label: "Endpoint URL", placeholder: "https://example.com/webhooks/calls", required: true },
          ]}
        />
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="px-5 py-3 font-medium">URL</th>
              <th className="px-5 py-3 font-medium">Events</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700/70">
            {webhooks.map((w) => (
              <tr key={w.id}>
                <td className="px-5 py-3 font-mono text-[13px]">{w.url}</td>
                <td className="px-5 py-3 text-ink-300">{w.events.join(", ")}</td>
                <td className="px-5 py-3">
                  <span className={w.active ? "badge-ok" : "badge-muted"}>
                    {w.active ? "active" : "disabled"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {webhooks.length === 0 && (
          <p className="px-5 py-8 text-sm text-ink-400">No webhook endpoints yet.</p>
        )}
      </div>
    </div>
  );
}
