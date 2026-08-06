import Link from "next/link";

function Orb({ size, className = "" }: { size: number; className?: string }) {
  return (
    <span
      className={`orb inline-block ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

function Waveform() {
  // Symmetric animated bars framing the central glowing orb.
  const bars = [
    0.25, 0.5, 0.35, 0.7, 0.45, 0.85, 0.6, 0.95, 0.7, 1, 0.8, 0.55,
  ];
  const all = [...bars, ...bars.slice().reverse()];
  return (
    <div className="flex h-40 w-full items-center justify-center gap-1.5 sm:gap-2" aria-hidden>
      {all.slice(0, 12).map((h, i) => (
        <span
          key={`l${i}`}
          className="w-1.5 rounded-full bg-gradient-to-t from-accent-600 via-glow-pink to-signal-blue animate-wave"
          style={{ height: `${h * 100}%`, animationDelay: `${i * 110}ms`, opacity: 0.85 }}
        />
      ))}
      <span className="relative mx-3 flex h-24 w-24 shrink-0 items-center justify-center sm:h-28 sm:w-28">
        <span className="orb absolute inset-0 animate-orbPulse" />
        <svg viewBox="0 0 24 24" className="relative h-9 w-9 text-white" fill="currentColor" aria-hidden>
          <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
        </svg>
      </span>
      {all.slice(12).map((h, i) => (
        <span
          key={`r${i}`}
          className="w-1.5 rounded-full bg-gradient-to-t from-accent-600 via-glow-pink to-signal-blue animate-wave"
          style={{ height: `${h * 100}%`, animationDelay: `${(11 - i) * 110}ms`, opacity: 0.85 }}
        />
      ))}
    </div>
  );
}

const PARTNERS = [
  "Asterisk", "NorthDuet", "Nectar", "Recycle", "Oasis", "Cloudform",
  "OHealth", "Veterinary", "FastAid", "Mainpoint",
];

const WHY = [
  {
    title: "Hands-free efficiency",
    body: "Your phone lines answer themselves — support, scheduling, and qualification handled without your team lifting a finger.",
    wide: true,
  },
  {
    title: "Personalized experiences",
    body: "Agents adapt to your business's voice, knowledge, and rules, giving every caller accurate, tailored answers.",
    wide: false,
  },
  {
    title: "Human-supervised AI",
    body: "Live transcripts, sentiment flags, and one-click takeover keep a person in command of every conversation.",
    wide: false,
  },
  {
    title: "Seamless integration",
    body: "Works on your existing numbers and syncs to your calendar and CRM — no migration, no downtime.",
    wide: true,
  },
];

const STEPS = [
  {
    title: "Sign up and set up",
    body: "Create your workspace and configure your first agent — voice, greeting, instructions — in minutes.",
  },
  {
    title: "Customize your experience",
    body: "Attach your knowledge base, connect your phone number, and set escalation rules for your team.",
  },
  {
    title: "Go live with supervision",
    body: "Your agent takes real calls while supervisors watch live transcripts and take over anytime.",
  },
];

const KEY_FEATURES = [
  {
    n: "01",
    title: "Advanced speech recognition",
    body: "Understands natural, multi-turn conversation across accents and phrasing — no rigid phone menus.",
  },
  {
    n: "02",
    title: "Live human supervision",
    body: "Sentiment and confidence scoring flag conversations the moment they turn, with one-click takeover.",
  },
  {
    n: "03",
    title: "Cross-platform observability",
    body: "Every call recorded, transcribed, summarized, and searchable from one dashboard on any device.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Our front desk stopped missing calls entirely. The takeover button is the feature that convinced us — we're always one click from stepping in.",
    name: "Alex Carter",
    role: "Operations Manager, dental group",
  },
  {
    quote:
      "We launched an outbound follow-up campaign in an afternoon. The AI books the demos; my team just shows up to them.",
    name: "Priya N.",
    role: "Head of Sales, home services",
  },
  {
    quote:
      "The live transcripts changed how we coach. We watch real calls and step in when it matters instead of auditing recordings a week later.",
    name: "Dana R.",
    role: "Support Lead, e-commerce",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-ink-950">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/80 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Orb size={26} />
            <span className="text-[17px] tracking-tight">
              <span className="font-bold">Voice</span>
              <span className="font-light text-ink-300">Line AI</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-ink-300 md:flex">
            <a href="#about" className="transition hover:text-ink-100">About</a>
            <a href="#features" className="transition hover:text-ink-100">Features</a>
            <a href="#how" className="transition hover:text-ink-100">Solution</a>
            <a href="#testimonials" className="transition hover:text-ink-100">Customers</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-ink-300 transition hover:text-ink-100">
              Log in
            </Link>
            <Link href="/signup" className="btn-secondary !px-4 !py-2">
              Contact
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[480px]"
          style={{
            background:
              "radial-gradient(55% 60% at 50% 0%, rgba(139,92,246,0.28) 0%, rgba(217,70,239,0.12) 45%, rgba(7,7,9,0) 75%)",
          }}
        />
        <div className="container-page relative flex flex-col items-center pt-20 text-center sm:pt-24">
          <span className="mb-5 flex items-center gap-2 rounded-full border border-ink-700 bg-ink-850/80 px-4 py-1.5 text-xs text-ink-300">
            <span className="text-glow-orange">★</span> AI voice agents with live human supervision
          </span>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Change the way your business{" "}
            <span className="grad-text">answers the phone</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ink-300">
            Voice agents that answer, schedule, and qualify on your lines —
            while your team watches live transcripts and takes over any call in
            one click.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className="btn-primary !px-7 !py-3 !text-base">
              Try for free
            </Link>
            <a href="#how" className="btn-secondary !px-7 !py-3 !text-base">
              Learn more →
            </a>
          </div>
          <div className="mt-14 w-full max-w-3xl animate-rise">
            <Waveform />
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-24">
        <div className="container-page">
          <div className="card card-hover !p-8 sm:!p-12">
            <h2 className="text-3xl font-bold tracking-tight">
              About <span className="grad-text">VoiceLine AI</span>
            </h2>
            <div className="mt-8 grid items-center gap-10 md:grid-cols-[260px_1fr]">
              <div className="flex justify-center">
                <span className="relative flex h-52 w-52 items-center justify-center rounded-full border border-ink-700 bg-ink-900">
                  <span className="absolute inset-6 rounded-full border border-ink-700/70" />
                  <Orb size={120} className="animate-orbPulse" />
                </span>
              </div>
              <div className="space-y-4 text-ink-300">
                <p>
                  VoiceLine AI is a platform that puts intelligent voice agents
                  on your existing phone lines. Callers speak naturally; the
                  agent answers from your knowledge, books appointments, and
                  qualifies leads — hands-free for your team.
                </p>
                <p>
                  What makes it different is supervision: every live call
                  streams into a monitoring console with sentiment and
                  confidence scores, and a human can take over mid-sentence at
                  any time. AI does the talking; people stay in command.
                </p>
                <Link href="/signup" className="btn-primary mt-2 inline-flex">
                  Try for free
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Partners */}
      <section className="pb-24">
        <div className="container-page">
          <p className="text-center text-sm text-ink-400">
            Most of our <span className="font-semibold text-ink-200">trusted partners</span>
          </p>
          <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-2xl border border-ink-700 sm:grid-cols-5">
            {PARTNERS.map((p) => (
              <div
                key={p}
                className="flex items-center justify-center gap-2 border border-ink-700/60 bg-ink-850 px-4 py-5 text-sm font-medium text-ink-300 transition duration-200 hover:bg-ink-800 hover:text-ink-100"
              >
                <span className="h-2 w-2 rounded-full bg-gradient-to-r from-accent-500 to-glow-pink" />
                {p}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why choose — bento boxes */}
      <section id="features" className="pb-24">
        <div className="container-page">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Why choose <span className="grad-text">supervised voice AI?</span>
          </h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {WHY.map((w) => (
              <div
                key={w.title}
                className={`card card-hover !p-7 ${w.wide ? "md:col-span-2" : ""}`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-800">
                  <span className="h-4 w-4 rounded-full bg-gradient-to-tr from-accent-500 via-glow-pink to-glow-orange" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{w.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-300">{w.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="pb-24">
        <div className="container-page">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            How it <span className="grad-text">works</span>
          </h2>
          <div className="card card-hover relative mt-12 overflow-hidden !p-0">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(60% 80% at 50% 0%, rgba(139,92,246,0.16) 0%, rgba(7,7,9,0) 70%)",
              }}
            />
            <div className="relative flex justify-center pb-4 pt-12">
              <span className="relative flex h-24 w-24 items-center justify-center">
                <span className="orb absolute inset-0 animate-orbPulse" />
                <svg viewBox="0 0 24 24" className="relative h-8 w-8 text-white" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </div>
            <div className="relative grid gap-6 px-7 pb-10 pt-6 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <div key={s.title} className="text-center sm:text-left">
                  <p className="text-xs font-semibold uppercase tracking-widest text-accent-400">
                    Step {i + 1}
                  </p>
                  <h3 className="mt-1.5 font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Key features */}
      <section className="pb-24">
        <div className="container-page">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Key features of <span className="grad-text">VoiceLine AI</span>
          </h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {KEY_FEATURES.map((f) => (
              <div key={f.n} className="card card-hover !p-7">
                <p className="grad-text text-sm font-bold">{f.n}</p>
                <h3 className="mt-3 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-300">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="pb-24">
        <div className="container-page">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            What our <span className="grad-text">customers say</span>
          </h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="card card-hover flex flex-col !p-7">
                <blockquote className="flex-1 text-sm leading-relaxed text-ink-200">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <Orb size={34} />
                  <span>
                    <span className="block text-sm font-semibold">{t.name}</span>
                    <span className="block text-xs text-ink-400">{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24">
        <div className="container-page">
          <div className="grad-bg relative overflow-hidden rounded-3xl px-8 py-14 text-center shadow-2xl shadow-accent-600/20">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Get started today
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-white/85">
              Ready to experience the power of supervised voice AI? Build your
              first agent in the next five minutes.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-full bg-white px-7 py-3 text-sm font-semibold text-ink-950 transition hover:bg-white/90"
              >
                Get started for free
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center rounded-full border border-white/50 px-7 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Explore features
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-800 py-12">
        <div className="container-page flex flex-col items-center justify-between gap-8 sm:flex-row sm:items-start">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <Orb size={24} />
              <span className="tracking-tight">
                <span className="font-bold">Voice</span>
                <span className="font-light text-ink-300">Line AI</span>
              </span>
            </Link>
            <p className="mt-3 text-xs text-ink-400">
              © {new Date().getFullYear()} VoiceLine AI · Enterprise voice AI
              with live human supervision.
            </p>
          </div>
          <form action="/signup" className="w-full max-w-sm">
            <p className="text-sm font-medium">Subscribe to the newsletter</p>
            <div className="mt-3 flex overflow-hidden rounded-full border border-ink-600 bg-ink-900 focus-within:border-accent-500">
              <input
                type="email"
                placeholder="Enter your email"
                className="w-full bg-transparent px-4 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none"
                aria-label="Email address"
              />
              <button className="grad-bg m-1 rounded-full px-5 text-sm font-semibold text-white transition hover:brightness-110">
                Subscribe
              </button>
            </div>
          </form>
        </div>
      </footer>
    </div>
  );
}
