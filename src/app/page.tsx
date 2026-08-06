import Link from "next/link";

function Waveform() {
  const bars = [0.5, 0.9, 0.6, 1, 0.7, 0.4, 0.85, 0.55, 0.95, 0.65, 0.45, 0.8];
  return (
    <div className="flex h-8 items-center gap-1" aria-hidden>
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-1 rounded-full bg-accent-500 animate-wave"
          style={{ height: `${h * 100}%`, animationDelay: `${i * 90}ms` }}
        />
      ))}
    </div>
  );
}

const FEATURES = [
  {
    title: "No-code agent builder",
    body: "Describe how your agent should greet callers, what it knows, and when to hand off. Pick a voice, attach your documents, and go live in minutes — no engineering required.",
  },
  {
    title: "Live human supervision",
    body: "Watch every active call with a real-time transcript, sentiment, and confidence score. When a conversation turns, a supervisor takes over in one click — the caller never notices the switch.",
  },
  {
    title: "Full observability",
    body: "Every call is recorded, transcribed, summarized, and scored automatically. Search past conversations, audit every decision the agent made, and export anything.",
  },
  {
    title: "Works on your phone lines",
    body: "Keep your existing numbers and carrier. We connect over standard SIP/Twilio, so there's no migration, no porting, and no downtime.",
  },
  {
    title: "Knowledge base answers",
    body: "Upload FAQs, policies, and product docs. The agent answers from your content — and says \"let me connect you to the team\" when it isn't sure, instead of guessing.",
  },
  {
    title: "CRM & calendar sync",
    body: "Appointments land on your calendar, leads land in your CRM, and structured call outcomes are extracted automatically after every conversation.",
  },
];

const USE_CASES = [
  {
    name: "Inbound support",
    detail: "Answer every call 24/7, resolve tier-1 issues, and escalate the rest with full context.",
  },
  {
    name: "Appointment scheduling",
    detail: "Book, move, and confirm appointments directly on your calendar — with SMS confirmations.",
  },
  {
    name: "Outbound campaigns",
    detail: "Personalized follow-ups and reminders at scale, with automatic callback scheduling.",
  },
  {
    name: "Lead qualification",
    detail: "Qualify inbound and outbound leads on budget and timeline, then book demos for your closers.",
  },
];

const FAQS = [
  {
    q: "Do I need to change my phone number or carrier?",
    a: "No. Agents connect to your existing numbers over SIP or a Twilio integration. You can also provision new numbers per agent if you prefer a clean split.",
  },
  {
    q: "What happens when the AI can't handle a call?",
    a: "The agent escalates to your team with the full transcript and a one-line summary, so the human picks up mid-conversation without asking the caller to repeat anything. Supervisors can also proactively take over any live call.",
  },
  {
    q: "Can I listen to calls while they happen?",
    a: "Yes — the live monitoring console shows every active call with a streaming transcript, sentiment, and confidence score, and flags calls that need attention.",
  },
  {
    q: "How long does setup take?",
    a: "A first agent takes minutes: name it, pick a voice, paste your greeting and instructions, attach documents. Connecting production phone lines is typically a same-week project.",
  },
  {
    q: "Is my data secure?",
    a: "Accounts are fully isolated per business, calls are encrypted in transit, and recordings/transcripts live in your workspace. Compliance controls (retention windows, redaction, audit logs) are on the roadmap for regulated industries.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ink-950">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/85 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500 font-bold text-ink-950">
              V
            </span>
            <span className="text-base font-semibold tracking-tight">
              VoiceLine AI
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-ink-300 md:flex">
            <a href="#features" className="hover:text-ink-100">Features</a>
            <a href="#supervision" className="hover:text-ink-100">Live supervision</a>
            <a href="#use-cases" className="hover:text-ink-100">Use cases</a>
            <a href="#faq" className="hover:text-ink-100">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-ink-300 hover:text-ink-100">
              Log in
            </Link>
            <Link href="/signup" className="btn-primary !px-4 !py-2">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(34,197,139,0.14) 0%, rgba(7,9,15,0) 70%)",
          }}
        />
        <div className="container-page relative flex flex-col items-center pb-20 pt-20 text-center sm:pt-28">
          <div className="mb-6 flex items-center gap-2 rounded-full border border-ink-700 bg-ink-850 px-4 py-1.5 text-xs text-ink-300">
            <span className="h-2 w-2 rounded-full bg-accent-500 animate-pulseDot" />
            Every call answered. Every call supervised.
          </div>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            AI voice agents your customers{" "}
            <span className="text-accent-400">actually trust</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ink-300">
            Build voice agents that answer, schedule, and qualify on your
            existing phone lines — while your team watches live transcripts and
            takes over any call in one click.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className="btn-primary !px-7 !py-3 !text-base">
              Create your first agent
            </Link>
            <a href="#supervision" className="btn-secondary !px-7 !py-3 !text-base">
              See live supervision
            </a>
          </div>

          {/* Hero mock: live call card */}
          <div className="mt-16 w-full max-w-3xl animate-rise">
            <div className="card overflow-hidden !p-0 text-left shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between border-b border-ink-700 bg-ink-800/70 px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 rounded-full bg-accent-500/15 px-2.5 py-1 text-xs font-medium text-accent-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent-400 animate-pulseDot" />
                    LIVE
                  </span>
                  <span className="text-sm font-medium">Front Desk · +1 (415) 555-0132</span>
                </div>
                <Waveform />
              </div>
              <div className="space-y-3 px-5 py-5 font-mono text-[13px] leading-relaxed">
                <p><span className="text-accent-400">agent</span> <span className="text-ink-200">Thanks for calling — how can I help you today?</span></p>
                <p><span className="text-signal-blue">caller</span> <span className="text-ink-200">Hi, I need to move my appointment on Thursday.</span></p>
                <p><span className="text-accent-400">agent</span> <span className="text-ink-200">No problem. I have Friday at 11:15 or 2:30 — would either work?</span></p>
                <p className="text-ink-500">caller is speaking…</p>
              </div>
              <div className="flex items-center justify-between border-t border-ink-700 bg-ink-800/40 px-5 py-3 text-xs text-ink-400">
                <span>
                  Sentiment <span className="font-medium text-accent-400">positive</span>
                  <span className="mx-2 text-ink-600">·</span>
                  Confidence <span className="font-medium text-ink-200">94%</span>
                </span>
                <span className="rounded-md border border-ink-600 px-2.5 py-1 font-medium text-ink-200">
                  Take over call
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-ink-800 py-20">
        <div className="container-page">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Everything a phone team does. <span className="text-accent-400">Automated, observed, supervised.</span>
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

      {/* Supervision spotlight */}
      <section id="supervision" className="border-t border-ink-800 bg-ink-900/60 py-20">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-accent-400">
              Live supervision
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              AI does the talking. Humans stay in command.
            </h2>
            <ul className="mt-7 space-y-5 text-ink-300">
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent-500" />
                <p><strong className="text-ink-100">Streaming transcripts</strong> of every active call, side by side, in one console.</p>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent-500" />
                <p><strong className="text-ink-100">Sentiment & confidence scoring</strong> that flags a conversation the moment it starts turning.</p>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent-500" />
                <p><strong className="text-ink-100">One-click takeover</strong> — a supervisor joins mid-sentence with full context. The caller never hears a transfer.</p>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent-500" />
                <p><strong className="text-ink-100">Context-rich escalation</strong> — when the AI hands off, your team gets the transcript and a one-line summary, not a cold start.</p>
              </li>
            </ul>
          </div>
          <div className="card !p-0">
            <div className="border-b border-ink-700 px-5 py-3 text-sm font-medium">
              Monitoring console · 3 active calls
            </div>
            <div className="divide-y divide-ink-700">
              {[
                { agent: "Front Desk", topic: "Appointment scheduling", s: "positive", flag: false },
                { agent: "Support Line", topic: "Order status", s: "positive", flag: false },
                { agent: "Support Line", topic: "Billing question", s: "negative", flag: true },
              ].map((c, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-sm font-medium">{c.agent}</p>
                    <p className="text-xs text-ink-400">{c.topic}</p>
                  </div>
                  {c.flag ? (
                    <span className="rounded-full bg-signal-red/15 px-3 py-1 text-xs font-semibold text-signal-red">
                      Needs attention
                    </span>
                  ) : (
                    <span className="rounded-full bg-accent-500/15 px-3 py-1 text-xs font-medium text-accent-400">
                      {c.s}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="use-cases" className="border-t border-ink-800 py-20">
        <div className="container-page">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Built for the calls your business already gets
          </h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {USE_CASES.map((u) => (
              <div key={u.name} className="card">
                <h3 className="text-base font-semibold text-accent-400">{u.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-300">{u.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-ink-800 bg-ink-900/60 py-20">
        <div className="container-page max-w-3xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h2>
          <div className="mt-10 space-y-3">
            {FAQS.map((f) => (
              <details key={f.q} className="card group !p-0">
                <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold marker:hidden">
                  <span className="mr-2 inline-block text-accent-400 transition group-open:rotate-90">›</span>
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
      <section className="border-t border-ink-800 py-20">
        <div className="container-page flex flex-col items-center text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Put your phones on autopilot — with a human hand on the wheel.
          </h2>
          <p className="mt-4 max-w-xl text-ink-300">
            Create a workspace, build your first agent, and see the live
            monitoring console in action in the next five minutes.
          </p>
          <Link href="/signup" className="btn-primary mt-8 !px-8 !py-3 !text-base">
            Get started free
          </Link>
        </div>
      </section>

      <footer className="border-t border-ink-800 py-8">
        <div className="container-page flex flex-col items-center justify-between gap-3 text-xs text-ink-500 sm:flex-row">
          <span>© {new Date().getFullYear()} VoiceLine AI. All rights reserved.</span>
          <span>AI voice agents with live human supervision.</span>
        </div>
      </footer>
    </div>
  );
}
