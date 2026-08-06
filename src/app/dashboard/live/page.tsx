import LiveConsole from "@/components/dashboard/LiveConsole";

export const metadata = { title: "Live monitoring — VoiceLine AI" };

export default function LivePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight">
          Live monitoring
          <span className="flex items-center gap-1.5 rounded-full bg-accent-500/15 px-2.5 py-1 text-xs font-medium text-accent-400">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-400 animate-pulseDot" />
            LIVE
          </span>
        </h1>
        <p className="mt-1 text-sm text-ink-400">
          Streaming transcripts of every active call. Calls that need attention are
          flagged automatically. (Simulated feed until telephony is connected — see README.)
        </p>
      </div>
      <LiveConsole />
    </div>
  );
}
