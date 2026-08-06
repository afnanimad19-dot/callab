import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listCalls } from "@/lib/db";

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function CallsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const calls = listCalls(session.userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Call history</h1>
        <p className="mt-1 text-sm text-ink-400">
          Every call is recorded, transcribed, summarized, and scored automatically.
        </p>
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="px-5 py-3 font-medium">When</th>
              <th className="px-5 py-3 font-medium">Agent</th>
              <th className="px-5 py-3 font-medium">Caller</th>
              <th className="px-5 py-3 font-medium">Direction</th>
              <th className="px-5 py-3 font-medium">Duration</th>
              <th className="px-5 py-3 font-medium">Sentiment</th>
              <th className="px-5 py-3 font-medium">Outcome</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700/70">
            {calls.map((c) => (
              <tr key={c.id} className="transition hover:bg-ink-800/50">
                <td className="px-5 py-3 text-ink-300">
                  <Link href={`/dashboard/calls/${c.id}`} className="block">
                    {formatWhen(c.startedAt)}
                  </Link>
                </td>
                <td className="px-5 py-3 font-medium">{c.agentName}</td>
                <td className="px-5 py-3 text-ink-300">{c.callerNumber}</td>
                <td className="px-5 py-3 text-ink-300">{c.direction}</td>
                <td className="px-5 py-3 text-ink-300">
                  {Math.floor(c.durationSec / 60)}m {c.durationSec % 60}s
                </td>
                <td className="px-5 py-3">
                  <span
                    className={
                      c.sentiment === "positive"
                        ? "text-accent-400"
                        : c.sentiment === "negative"
                          ? "text-signal-red"
                          : "text-ink-300"
                    }
                  >
                    {c.sentiment}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <Link
                    href={`/dashboard/calls/${c.id}`}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      c.outcome === "escalated"
                        ? "bg-signal-red/15 text-signal-red"
                        : "bg-accent-500/15 text-accent-400"
                    }`}
                  >
                    {c.outcome.replace("_", " ")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {calls.length === 0 && (
          <p className="px-5 py-8 text-sm text-ink-400">No calls yet.</p>
        )}
      </div>
    </div>
  );
}
