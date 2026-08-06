import Link from "next/link";

const SHOWCASE = [
  {
    title: "Build",
    body: "Configure an agent in minutes — voice, greeting, instructions, knowledge. No code required.",
  },
  {
    title: "Live Monitoring",
    body: "Watch every active call with streaming transcripts, sentiment, and one-click takeover.",
  },
  {
    title: "Observability",
    body: "Every call recorded, transcribed, summarized, and scored — searchable forever.",
  },
];

const FEATURES = [
  {
    title: "Post-call analysis",
    body: "Automatic summaries, outcomes, and sentiment on every conversation, extracted the moment a call ends.",
  },
  {
    title: "Call transfer",
    body: "Context-aware transfers between AI agents and your team — the caller never repeats themselves.",
  },
  {
    title: "CRM updated on every call",
    body: "Structured call data mapped into your CRM automatically: leads, outcomes, follow-ups.",
  },
  {
    title: "Batch calling",
    body: "Personalized outbound campaigns at scale with automatic callback scheduling.",
  },
  {
    title: "Knowledge base answers",
    body: "Agents answer from your documents — and hand off to a human instead of guessing.",
  },
  {
    title: "Works on your phone lines",
    body: "Keep your numbers and carrier. Connect over standard telephony with no migration.",
  },
];

const SUPERVISION_POINTS = [
  {
    title: "Real-time transcripts",
    body: "Every active call streams into one console, side by side.",
  },
  {
    title: "Sentiment and confidence scoring",
    body: "Conversations are flagged the moment they start turning.",
  },
  {
    title: "One-click takeover",
    body: "A supervisor joins mid-sentence with full context. The caller never hears a transfer.",
  },
];

const STEPS = [
  {
    title: "Discovery call",
    body: "We map your call flows, edge cases, and escalation rules together.",
  },
  {
    title: "Pilot deployment",
    body: "Your first agent goes live on a real line with supervisors watching every call.",
  },
  {
    title: "Scale",
    body: "Roll out across teams, numbers, and campaigns with full observability.",
  },
];

const COMPARISON: [string, string, string, string][] = [
  ["Setup time", "Days", "Months", "Weeks of hiring"],
  ["Live human oversight", "Built-in, every call", "None", "Only the calls they take"],
  ["Answers 24/7", "Yes", "Menus only", "Business hours"],
  ["Cost per call", "Low, predictable", "Low but frustrating", "High and variable"],
  ["Improves over time", "Yes — transcripts feed tuning", "No", "Depends on training"],
];

const FAQS = [
  {
    q: "How do AI voice agents work?",
    a: "Callers speak naturally; the agent transcribes in real time, reasons with a large language model over your knowledge and instructions, and responds with a natural voice — while taking actions like booking appointments or logging tickets.",
  },
  {
    q: "What happens when the AI can't handle a call?",
    a: "It escalates to your team with the full transcript and a one-line summary. Supervisors can also proactively take over any live call in one click.",
  },
  {
    q: "Do I need to change my phone number or carrier?",
    a: "No. Agents connect to your existing numbers, or you can provision new numbers per agent.",
  },
  {
    q: "Can I listen to calls while they happen?",
    a: "Yes — the live monitoring console shows every active call with a streaming transcript, sentiment, and confidence score.",
  },
  {
    q: "How long does setup take?",
    a: "A first agent takes minutes. Production phone lines are typically a same-week project.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-ink-700 bg-white/85 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-accent-500 to-accent-300 font-bold text-white">
              V
            </span>
            <span className="text-[17px] tracking-tight">
              <span className="font-bold">Voice</span>
              <span className="font-light text-ink-300">Line AI</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-ink-300 md:flex">
            <a href="#action" className="hover:text-ink-100">Solutions</a>
            <a href="#features" className="hover:text-ink-100">Features</a>
            <a href="#supervision" className="hover:text-ink-100">Supervision</a>
            <a href="#faq" className="hover:text-ink-100">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-ink-300 hover:text-ink-100">
              Log in
            </Link>
            <Link href="/signup" className="btn-dark !px-4 !py-2">
              Book a demo
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            "radial-gradient(80% 90% at 70% 10%, rgba(196,181,253,0.45) 0%, rgba(251,207,232,0.35) 40%, rgba(255,255,255,1) 85%)",
        }}
      >
        <div className="container-page flex flex-col items-center pb-16 pt-24 text-center sm:pt-28">
          <span className="mb-6 rounded-full border border-accent-300 bg-white/70 px-4 py-1.5 text-xs font-medium text-accent-700">
            Every call answered · Every call supervised
          </span>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            AI-voice agents with{" "}
            <span className="bg-gradient-to-r from-accent-600 to-accent-400 bg-clip-text text-transparent">
              live human supervision
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ink-300">
            Voice agents that answer, schedule, and qualify on your phone lines —
            while your team watches live transcripts and can take over any call
            in one click.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className="btn-dark !px-7 !py-3 !text-base">
              Book a demo
            </Link>
            <Link href="/signup" className="btn-secondary !px-7 !py-3 !text-base">
              Try an agent →
            </Link>
          </div>
          <p className="mt-14 text-xs font-medium uppercase tracking-widest text-ink-400">
            Built for support, sales, and scheduling teams
          </p>
        </div>
      </section>

      {/* See it in action */}
      <section id="action" className="border-t border-ink-700 py-20">
        <div className="container-page">
          <div className="flex items-end justify-between">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">See it in action</h2>
            <Link href="/signup" className="hidden text-sm font-medium text-accent-600 hover:text-accent-500 sm:block">
              Try it right now →
            </Link>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {SHOWCASE.map((s) => (
              <div key={s.title} className="card !p-6">
                <div className="mb-4 flex h-28 items-center justify-center rounded-lg bg-ink-800 text-4xl text-accent-400">
                  {s.title === "Build" ? "⚙" : s.title === "Live Monitoring" ? "◉" : "📊"}
                </div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-ink-700 bg-ink-950 py-20">
        <div className="container-page">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-accent-600">
            Core features
          </p>
          <h2 className="mt-3 text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Everything a modern contact center needs
          </h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card">
                <h3 className="text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-300">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supervision */}
      <section id="supervision" className="border-t border-ink-700 py-20">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              A human supervisor on every call
            </h2>
            <p className="mt-4 text-ink-300">
              AI does the talking. Your team stays in command.
            </p>
            <ul className="mt-7 space-y-5">
              {SUPERVISION_POINTS.map((p) => (
                <li key={p.title} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent-500" />
                  <p className="text-ink-300">
                    <strong className="text-ink-100">{p.title}.</strong> {p.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div className="card !p-0">
            <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3">
              <span className="text-sm font-semibold">Live call · Support Line</span>
              <span className="badge-ok">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent-500 animate-pulseDot" />
                LIVE
              </span>
            </div>
            <div className="space-y-3 px-5 py-5 font-mono text-[13px] leading-relaxed">
              <p><span className="text-accent-600">agent</span> <span className="text-ink-200">Thanks for calling — how can I help?</span></p>
              <p><span className="text-signal-blue">caller</span> <span className="text-ink-200">My invoice this month is higher than usual.</span></p>
              <p><span className="text-accent-600">agent</span> <span className="text-ink-200">I see an added usage charge — let me flag a supervisor with the details.</span></p>
              <p className="text-ink-400">supervisor joining…</p>
            </div>
            <div className="flex items-center justify-between border-t border-ink-700 bg-ink-800/60 px-5 py-3 text-xs">
              <span className="text-ink-400">
                Sentiment <span className="font-medium text-signal-amber">turning</span>
                <span className="mx-2">·</span>
                Confidence <span className="font-medium text-ink-100">58%</span>
              </span>
              <span className="rounded-md bg-accent-500 px-3 py-1.5 font-semibold text-white">
                Take over call
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Deployment steps */}
      <section className="border-t border-ink-700 bg-ink-950 py-20">
        <div className="container-page">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            From first call to full deployment in days
          </h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="card !p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-500/10 text-sm font-bold text-accent-600">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="border-t border-ink-700 py-20">
        <div className="container-page">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Why we&apos;re different
          </h2>
          <div className="card mx-auto mt-12 max-w-4xl overflow-x-auto !p-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-ink-700 bg-ink-800/60 text-left">
                  <th className="px-5 py-3.5 font-medium text-ink-400">Capability</th>
                  <th className="px-5 py-3.5 font-semibold text-accent-600">VoiceLine AI</th>
                  <th className="px-5 py-3.5 font-medium text-ink-400">Legacy IVR</th>
                  <th className="px-5 py-3.5 font-medium text-ink-400">Hiring more staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/70">
                {COMPARISON.map(([cap, us, ivr, staff]) => (
                  <tr key={cap}>
                    <td className="px-5 py-3.5 font-medium">{cap}</td>
                    <td className="px-5 py-3.5 font-semibold text-accent-700">{us}</td>
                    <td className="px-5 py-3.5 text-ink-300">{ivr}</td>
                    <td className="px-5 py-3.5 text-ink-300">{staff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Enterprise (dark band) */}
      <section className="bg-[#120e1e] py-20 text-white">
        <div className="container-page">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Enterprise-ready from day one
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-white/60">
            Workspace isolation per business, encrypted sessions, and full call
            audit trails — with recording-consent controls, retention windows,
            and compliance certifications on the roadmap as we grow.
          </p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { t: "Isolated workspaces", b: "Every business's agents, calls, and contacts are fully separated." },
              { t: "Encrypted sessions", b: "Signed, httpOnly session tokens; passwords hashed with bcrypt." },
              { t: "Full audit trail", b: "Every call, transcript, and takeover is logged and searchable." },
              { t: "Compliance roadmap", b: "Consent, retention, and redaction controls planned for regulated industries." },
            ].map((c) => (
              <div key={c.t} className="rounded-xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-sm font-semibold">{c.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{c.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-ink-700 py-20">
        <div className="container-page max-w-3xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            We&apos;ve got the answers
          </h2>
          <div className="mt-10 space-y-3">
            {FAQS.map((f) => (
              <details key={f.q} className="card group !p-0">
                <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold">
                  <span className="mr-2 inline-block text-accent-600 transition group-open:rotate-90">›</span>
                  {f.q}
                </summary>
                <p className="border-t border-ink-700 px-5 py-4 text-sm leading-relaxed text-ink-300">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="py-20"
        style={{
          background:
            "linear-gradient(100deg, rgba(124,58,237,0.92) 0%, rgba(167,139,250,0.9) 60%, rgba(244,114,182,0.85) 100%)",
        }}
      >
        <div className="container-page flex flex-col items-center text-center text-white">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Voice AI with live human supervision
          </h2>
          <p className="mt-4 max-w-xl text-white/85">
            Create a workspace, build your first agent, and watch the live
            monitoring console in the next five minutes.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-lg bg-white px-7 py-3 text-base font-semibold text-accent-700 transition hover:bg-white/90"
            >
              Book a demo
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-lg border border-white/50 px-7 py-3 text-base font-semibold text-white transition hover:bg-white/10"
            >
              Try an agent →
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-[#120e1e] py-10 text-white/60">
        <div className="container-page flex flex-col items-center justify-between gap-3 text-xs sm:flex-row">
          <span className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-accent-500 to-accent-300 text-[11px] font-bold text-white">
              V
            </span>
            © {new Date().getFullYear()} VoiceLine AI
          </span>
          <span>Enterprise voice AI with live human supervision.</span>
        </div>
      </footer>
    </div>
  );
}
