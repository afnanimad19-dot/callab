import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { findCall } from "@/lib/db";

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const call = findCall(session.userId, id);
  if (!call) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/calls" className="text-xs font-medium text-ink-400 hover:text-ink-200">
          ← Back to call history
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {call.agentName} · {call.callerNumber}
        </h1>
        <p className="mt-1 text-sm text-ink-400">
          {new Date(call.startedAt).toLocaleString()} · {call.direction} ·{" "}
          {Math.floor(call.durationSec / 60)}m {call.durationSec % 60}s
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">Outcome</p>
          <p className="mt-1.5 text-lg font-semibold capitalize">
            {call.outcome.replace("_", " ")}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">Sentiment</p>
          <p
            className={`mt-1.5 text-lg font-semibold capitalize ${
              call.sentiment === "positive"
                ? "text-accent-400"
                : call.sentiment === "negative"
                  ? "text-signal-red"
                  : ""
            }`}
          >
            {call.sentiment}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">AI confidence</p>
          <p className="mt-1.5 text-lg font-semibold">{Math.round(call.confidence * 100)}%</p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold">AI summary</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">{call.summary}</p>
      </div>

      <div className="card !p-0">
        <h2 className="border-b border-ink-700 px-5 py-3.5 text-sm font-semibold">
          Transcript
        </h2>
        <div className="space-y-4 px-5 py-5">
          {call.transcript.map((t, i) => (
            <div key={i} className="flex gap-3">
              <span
                className={`mt-0.5 w-24 shrink-0 text-xs font-semibold uppercase tracking-wide ${
                  t.speaker === "agent"
                    ? "text-accent-400"
                    : t.speaker === "supervisor"
                      ? "text-signal-amber"
                      : "text-signal-blue"
                }`}
              >
                {t.speaker}
              </span>
              <p className="text-sm leading-relaxed text-ink-200">{t.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
