import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Phone, CheckCircle2, Info, MessageSquare, Play } from "lucide-react";
import { getSession } from "@/lib/auth";
import { findAgent, findCall, listCampaigns, updateCall } from "@/lib/db";
import { getCallDetails } from "@/lib/vapi";
import AudioPlayer from "@/components/dashboard/AudioPlayer";

export const metadata = { title: "Call Details — VoiceLine AI" };

function fmtDuration(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-ink-400">{label}</p>
      <div className="mt-0.5 text-sm font-semibold">{children}</div>
    </div>
  );
}

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const call = await findCall(session.userId, id);
  if (!call) notFound();

  // Backfill on view: Vapi's recording AND full transcript become available
  // shortly after a call ends, sometimes after our log entry was written.
  // Fetch both and persist, so partial browser-side transcripts heal too.
  if (call.vapiCallId && (!call.recordingUrl || call.transcript.length < 2)) {
    const details = await getCallDetails(call.vapiCallId);
    if (details) {
      const patch: Partial<typeof call> = {};
      if (!call.recordingUrl && details.recordingUrl) {
        call.recordingUrl = details.recordingUrl;
        patch.recordingUrl = details.recordingUrl;
      }
      if (details.transcript.length > call.transcript.length) {
        call.transcript = details.transcript;
        patch.transcript = details.transcript;
      }
      if (details.durationSec > call.durationSec) {
        call.durationSec = details.durationSec;
        patch.durationSec = details.durationSec;
      }
      if (Object.keys(patch).length) await updateCall(session.userId, call.id, patch);
    }
  }

  const [agent, campaigns] = await Promise.all([
    findAgent(session.userId, call.agentId),
    listCampaigns(session.userId),
  ]);
  const campaign = campaigns.find((c) => c.id === call.campaignId);

  const inbound = call.direction === "inbound";
  const agentNum = agent?.phoneNumber ?? "—";
  const from = inbound ? call.callerNumber : agentNum;
  const to = inbound ? agentNum : call.callerNumber;
  const endedAt = new Date(
    Date.parse(call.startedAt) + call.durationSec * 1000
  ).toISOString();

  const sentimentBadge =
    call.sentiment === "positive"
      ? { label: "Satisfied", cls: "badge-ok" }
      : call.sentiment === "negative"
        ? { label: "Frustrated", cls: "badge-bad" }
        : { label: "Neutral", cls: "badge-muted" };
  const rating =
    call.sentiment === "positive" ? 5 : call.sentiment === "neutral" ? 3 : 2;

  // Static waveform bars (deterministic per call id so it's stable).
  const bars = Array.from({ length: 90 }, (_, i) => {
    const seed = (call.id.charCodeAt(i % call.id.length) * (i + 7)) % 100;
    return 20 + (seed % 70);
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card !p-5">
        <Link href="/dashboard/calls" className="text-sm text-ink-400 hover:text-ink-100">
          ← Back
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Call Details</h1>
          <span className="badge-ok">Ended</span>
          {call.isTest && <span className="badge-warn">Test call</span>}
        </div>
        <p className="mt-1 font-mono text-sm text-ink-300">
          {from} → {to}
          <span className="ml-2 font-sans text-ink-400">• {fmtWhen(call.startedAt)}</span>
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Call Details */}
        <div className="card !p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold"><Phone className="h-4 w-4 text-ink-400" /> Call Details</h2>
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5">
            <Field label="From"><span className="font-mono">{from}</span></Field>
            <Field label="To"><span className="font-mono">{to}</span></Field>
            <Field label="Started">{fmtWhen(call.startedAt)}</Field>
            <Field label="Ended">{fmtWhen(endedAt)}</Field>
            <Field label="Status"><span className="text-accent-300">Ended</span></Field>
            <Field label="Direction">{inbound ? "Incoming" : "Outgoing"}</Field>
            <Field label="Connection Duration">{fmtDuration(call.durationSec)}</Field>
            <Field label="Reason">{call.endReason}</Field>
            <Field label="Sentiment">
              <span className={sentimentBadge.cls}>{sentimentBadge.label}</span>
            </Field>
            <Field label="Task Status">
              <span className={call.outcome === "resolved" ? "badge-ok" : "badge-warn"}>
                {call.outcome === "resolved" ? "Completed" : call.outcome.replace("_", " ")}
              </span>
            </Field>
            <Field label="AI Confidence">{Math.round(call.confidence * 100)}%</Field>
            <Field label="Agent">
              <Link href={`/dashboard/agents/${call.agentId}`} className="text-accent-300 hover:text-accent-400">
                {call.agentName} ↗
              </Link>
            </Field>
            {campaign && (
              <Field label="Campaign">
                <Link href="/dashboard/launch" className="text-accent-300 hover:text-accent-400">
                  {campaign.name} ↗
                </Link>
              </Field>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {/* Call Outcome */}
          <div className="card !p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold"><CheckCircle2 className="h-4 w-4 text-ink-400" /> Call Outcome</h2>
            {agent?.outcomes?.length ? (
              <div className="mt-4 space-y-2">
                {agent.outcomes.map((o) => (
                  <div key={o.name} className="flex items-center justify-between rounded-lg bg-ink-800 px-3.5 py-2.5 text-sm">
                    <code className="text-xs text-accent-300">{o.name}</code>
                    <span className="text-xs text-ink-400">extracts after real calls</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-ink-400">
                No outcomes recorded for this call
              </p>
            )}
          </div>

          {/* Call Summary */}
          <div className="card !p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold"><Info className="h-4 w-4 text-ink-400" /> Call Summary</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-300">{call.summary}</p>
            <p className="mt-4 flex items-center gap-2 text-sm">
              <span className="text-ink-400">Rating:</span>
              <span className="tracking-wide text-signal-amber" aria-label={`${rating} out of 5`}>
                {"★".repeat(rating)}
                <span className="text-ink-600">{"★".repeat(5 - rating)}</span>
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Transcript */}
      <div className="card !p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold"><MessageSquare className="h-4 w-4 text-ink-400" /> Call Transcript</h2>

        {/* Recording player — plays via the proxy endpoint, which fetches a
            fresh signed URL from the voice provider on every play so links
            never expire. */}
        {call.recordingUrl || call.vapiCallId ? (
          <div className="mt-4">
            <AudioPlayer
              src={
                call.vapiCallId
                  ? `/api/calls/${call.id}/recording`
                  : (call.recordingUrl as string)
              }
              seedKey={call.id}
            />
          </div>
        ) : (
          <div
            className="mt-4 flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 px-4 py-3"
            title={
              call.isTest && !call.vapiCallId
                ? "Text test sessions don't produce an audio recording"
                : "The recording appears here once the voice provider finishes processing it — refresh in a moment"
            }
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink-600 text-ink-300">
              <Play className="h-4 w-4" />
            </span>
            <div className="flex h-8 flex-1 items-center gap-[2px] overflow-hidden" aria-hidden>
              {bars.map((h, i) => (
                <span key={i} className="w-[3px] rounded-full bg-ink-500/40" style={{ height: `${h}%` }} />
              ))}
            </div>
            <span className="shrink-0 text-xs text-ink-500">No recording</span>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between text-sm text-ink-400">
          <span>Conversation Timeline</span>
          <span>{call.transcript.length} messages</span>
        </div>

        <div className="mt-4 space-y-4">
          {call.transcript.map((t, i) => (
            <div key={i} className={`flex ${t.speaker === "caller" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] ${t.speaker === "caller" ? "text-right" : ""}`}>
                {t.speaker !== "caller" && (
                  <p className="mb-1 flex items-center gap-2 text-xs text-ink-400">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white ${t.speaker === "supervisor" ? "bg-signal-amber" : "grad-bg"}`}>
                      {t.speaker === "supervisor" ? "SV" : "AI"}
                    </span>
                    {t.speaker === "supervisor" ? "Supervisor" : "AI Agent"}
                  </p>
                )}
                <div className={`rounded-2xl border px-4 py-2.5 text-sm leading-relaxed ${
                  t.speaker === "caller"
                    ? "border-accent-500/30 bg-accent-500/10 text-ink-100"
                    : "border-ink-700 bg-ink-900 text-ink-200"
                }`}>
                  {t.text}
                </div>
                <p className="mt-1 font-mono text-[11px] text-ink-500">
                  {fmtDuration(t.at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
