import Link from "next/link";
import {
  ArrowRight,
  Activity,
  CalendarCheck,
  Eye,
  FileText,
  Lock,
  PhoneForwarded,
  Rocket,
  Scale,
  Search as SearchIcon,
  ShieldCheck,
  Users,
} from "lucide-react";

// Full-bleed premium landing page in a fixed light palette. Media panels use
// the generated brand video/imagery plus real product screenshots.

function PillButton({
  href,
  children,
  light = false,
}: {
  href: string;
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-3 rounded-full py-2 pl-7 pr-2 text-base font-medium transition-colors duration-200 ${
        light
          ? "border border-black/15 bg-white/70 text-black backdrop-blur hover:bg-white"
          : "bg-black text-white hover:bg-gray-800"
      }`}
    >
      {children}
      <span className={`rounded-full p-2 ${light ? "bg-black" : "bg-white"}`}>
        <ArrowRight className={`h-4 w-4 ${light ? "text-white" : "text-black"}`} />
      </span>
    </Link>
  );
}

const BRANDS: { name: string; style: React.CSSProperties }[] = [
  { name: "Asterisk", style: { fontFamily: "Georgia, serif", fontWeight: 700, letterSpacing: "-0.02em", fontSize: 15 } },
  { name: "NORTHDUET", style: { fontFamily: "Arial, sans-serif", fontWeight: 900, letterSpacing: "0.08em", fontSize: 13 } },
  { name: "Nectar", style: { fontFamily: "'Trebuchet MS', sans-serif", fontWeight: 600, letterSpacing: "0.01em", fontSize: 15, fontStyle: "italic" } },
  { name: "OASIS", style: { fontFamily: "'Courier New', monospace", fontWeight: 700, letterSpacing: "0.12em", fontSize: 13 } },
  { name: "Cloudform", style: { fontFamily: "Palatino, 'Book Antiqua', serif", fontWeight: 400, letterSpacing: "-0.01em", fontSize: 16 } },
  { name: "OHealth", style: { fontFamily: "Impact, 'Arial Narrow', sans-serif", fontWeight: 400, letterSpacing: "0.04em", fontSize: 14 } },
  { name: "FastAid", style: { fontFamily: "Verdana, sans-serif", fontWeight: 700, letterSpacing: "-0.03em", fontSize: 13 } },
];

const ACTION_CARDS = [
  {
    img: "/media/shot-build.jpg",
    title: "Build",
    body: "Configure an agent's voice, identity and guardrails in minutes — no code required.",
  },
  {
    img: "/media/shot-live.jpg",
    title: "Live Monitoring",
    body: "Watch every active call with streaming transcripts, and take over in one click.",
  },
  {
    img: "/media/shot-observe.jpg",
    title: "Observability",
    body: "Every call recorded, summarized and scored — searchable from one dashboard.",
  },
];

const CONTACT_CENTER_FEATURES = [
  {
    icon: FileText,
    title: "Post-call analysis",
    body: "Automatic summaries, outcomes and sentiment extracted the moment a call ends.",
  },
  {
    icon: PhoneForwarded,
    title: "Call transfer",
    body: "Context-aware transfers between AI agents and your team — callers never repeat themselves.",
  },
  {
    icon: Users,
    title: "CRM updated on every call",
    body: "Structured call data mapped into your records automatically: leads, outcomes, follow-ups.",
  },
  {
    icon: Activity,
    title: "Batch calling",
    body: "Personalized outbound campaigns at scale with automatic callback scheduling.",
  },
];

const DEPLOY_STEPS = [
  {
    icon: SearchIcon,
    title: "Discovery call",
    body: "We map your call flows, edge cases and escalation rules together.",
  },
  {
    icon: Rocket,
    title: "Pilot deployment",
    body: "Your first agent goes live on a real line with supervisors watching every call.",
  },
  {
    icon: Scale,
    title: "Scale",
    body: "Roll out across teams, numbers and campaigns with full observability.",
  },
];

const HUB_NODES = ["SIP Trunks", "Twilio", "Vapi", "PBX", "WebRTC", "Carriers", "CRM", "Calendar"];

const COMPARISON: [string, string, string, string][] = [
  ["Setup time", "Days", "Months", "Weeks of hiring"],
  ["Live human oversight", "Built-in, every call", "None", "Only the calls they take"],
  ["Answers 24/7", "Yes", "Menus only", "Business hours"],
  ["Cost per call", "Low, predictable", "Low but frustrating", "High and variable"],
  ["Improves over time", "Yes — transcripts feed tuning", "No", "Depends on training"],
];

const ENTERPRISE_CARDS = [
  { icon: Lock, t: "Isolated workspaces", b: "Every business's agents, calls and contacts are fully separated." },
  { icon: ShieldCheck, t: "Encrypted sessions", b: "Signed, httpOnly session tokens; passwords hashed with bcrypt." },
  { icon: Eye, t: "Full audit trail", b: "Every call, transcript and takeover is logged and searchable." },
  { icon: CalendarCheck, t: "Consent controls", b: "Recording-consent and retention settings per agent." },
  { icon: FileText, t: "Compliance roadmap", b: "Redaction and certifications planned for regulated industries." },
];

const CALL_TYPES = ["Inbound support", "Outbound campaigns", "Appointment scheduling", "Lead qualification"];

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

const FAQS = [
  {
    q: "How do AI voice agents work?",
    a: "Callers speak naturally; the agent transcribes in real time, reasons over your knowledge and instructions, and responds with a natural voice — while taking actions like booking appointments or logging tickets.",
  },
  {
    q: "What happens when the AI can't handle a call?",
    a: "It escalates to your team with the full transcript and a one-line summary. Supervisors can also proactively take over any live call in one click.",
  },
  {
    q: "Do I need to change my phone number or carrier?",
    a: "No. Agents connect to your existing numbers over standard telephony, or you can provision new numbers per agent.",
  },
  {
    q: "Can I listen to calls while they happen?",
    a: "Yes — the live monitoring console shows every active call with a streaming transcript, sentiment and confidence score.",
  },
  {
    q: "How long does setup take?",
    a: "A first agent takes minutes. Production phone lines are typically a same-week project.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col bg-[#F5F5F5]" style={{ colorScheme: "light" }}>
      {/* ============ Hero (full-bleed) ============ */}
      <div className="relative flex min-h-screen flex-col overflow-hidden">
        <video autoPlay muted loop playsInline poster="/media/hero.webp"
          className="absolute inset-0 h-full w-full object-cover">
          <source src="/media/hero-loop.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(245,245,245,0.7) 0%, rgba(245,245,245,0.25) 45%, rgba(245,245,245,0.65) 100%)" }} />

        <nav className="relative z-20 px-6 py-5 lg:px-12">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/media/logo.webp" alt="" className="h-8 w-8" />
              <span className="text-2xl font-medium tracking-tight text-black">VoiceLine</span>
            </Link>
            <div className="hidden items-center gap-8 md:flex">
              {[
                ["#action", "Product"],
                ["#features", "Features"],
                ["#different", "Why us"],
                ["#faq", "FAQ"],
              ].map(([href, label]) => (
                <a key={label} href={href}
                  className="text-base font-medium text-gray-700 transition-colors duration-200 hover:text-black">
                  {label}
                </a>
              ))}
            </div>
            <Link href="/login"
              className="rounded-full bg-black px-7 py-2.5 text-base font-medium text-white transition-colors duration-200 hover:bg-gray-800">
              Open Dashboard
            </Link>
          </div>
        </nav>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
          <span className="mb-6 flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-4 py-1.5 text-xs font-medium text-black/70 backdrop-blur">
            ★ Voice AI with a human hand on the wheel
          </span>
          <h1 className="max-w-4xl text-5xl font-medium leading-[1.05] text-black md:text-7xl"
            style={{ letterSpacing: "-0.04em" }}>
            AI voice agents with
            <br />
            live human supervision
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-black/70 md:text-lg">
            Automated agents that answer, schedule and qualify on your existing
            lines — while your team watches every word live.
          </p>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
            <PillButton href="/signup">Book a demo</PillButton>
            <PillButton href="/signup" light>Try an agent</PillButton>
          </div>
        </div>

        {/* Partner marquee pinned to hero bottom */}
        <div className="relative z-10 border-t border-black/5 bg-white/40 py-5 backdrop-blur">
          <div className="overflow-hidden">
            <div className="marquee-track">
              {[...BRANDS, ...BRANDS, ...BRANDS].map((b, i) => (
                <span key={i} className="mx-10 shrink-0 whitespace-nowrap text-black/50" style={b.style}>
                  {b.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ============ See it in action ============ */}
      <section id="action" className="px-6 py-24 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-4xl font-medium text-black md:text-5xl" style={{ letterSpacing: "-0.03em" }}>
            See it in action
          </h2>
          <Link href="/signup" className="text-sm font-medium text-black/60 transition hover:text-black">
            Try it right now →
          </Link>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {ACTION_CARDS.map((c) => (
            <div key={c.title} className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="border-b border-black/5 bg-[#FAFAFB] p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.img} alt={`${c.title} screen`} className="w-full rounded-lg border border-black/10" />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-medium text-black" style={{ letterSpacing: "-0.02em" }}>{c.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-black/60">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ Everything a modern contact center needs ============ */}
      <section id="features" className="px-6 pb-24 lg:px-12">
        <h2 className="text-center text-4xl font-medium text-black md:text-5xl" style={{ letterSpacing: "-0.03em" }}>
          Everything a modern contact center needs
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CONTACT_CENTER_FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0EAF7]">
                <f.icon className="h-5 w-5 text-[#301C3F]" strokeWidth={1.8} />
              </span>
              <h3 className="mt-4 text-lg font-medium text-black" style={{ letterSpacing: "-0.01em" }}>{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-black/60">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ A human supervisor on every call ============ */}
      <section className="bg-white px-6 py-24 lg:px-12">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-4xl font-medium text-black md:text-5xl" style={{ letterSpacing: "-0.03em" }}>
              A human supervisor
              <br />
              on every call
            </h2>
            <p className="mt-4 max-w-md text-black/60">
              AI does the talking. Your team stays in command of every conversation.
            </p>
            <ul className="mt-8 space-y-5">
              {[
                ["Real-time transcripts", "Every active call streams into one console, side by side."],
                ["Sentiment and confidence scoring", "Conversations are flagged the moment they start turning."],
                ["One-click takeover", "A supervisor joins mid-sentence with full context. The caller never hears a transfer."],
              ].map(([t, b]) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#301C3F]" />
                  <p className="text-black/70">
                    <strong className="font-medium text-black">{t}.</strong> {b}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div className="overflow-hidden rounded-2xl border border-black/10 bg-[#FAFAFB] p-3 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/media/shot-live.jpg" alt="Live monitoring console" className="w-full rounded-lg border border-black/10" />
          </div>
        </div>
      </section>

      {/* ============ Deployment steps ============ */}
      <section className="px-6 py-24 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-4xl font-medium text-black md:text-5xl" style={{ letterSpacing: "-0.03em" }}>
            From first call to full deployment in days
          </h2>
          <Link href="/signup" className="text-sm font-medium text-black/60 transition hover:text-black">
            Start today →
          </Link>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {DEPLOY_STEPS.map((s, i) => (
            <div key={s.title} className="rounded-2xl border border-black/10 bg-white p-7 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F0EAF7]">
                  <s.icon className="h-5 w-5 text-[#301C3F]" strokeWidth={1.8} />
                </span>
                <span className="text-sm font-semibold text-black/30">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-xl font-medium text-black" style={{ letterSpacing: "-0.02em" }}>{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-black/60">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ Telephony hub ============ */}
      <section className="bg-white px-6 py-24 lg:px-12">
        <h2 className="text-center text-4xl font-medium text-black md:text-5xl" style={{ letterSpacing: "-0.03em" }}>
          Integrates with your entire telephony stack
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-black/60">
          Keep your numbers, carrier and PBX. VoiceLine connects over the
          standards your infrastructure already speaks — no migration.
        </p>
        <div className="relative mx-auto mt-14 max-w-3xl">
          <svg viewBox="0 0 800 420" className="w-full" role="img" aria-label="Integration hub diagram">
            {HUB_NODES.map((label, i) => {
              const angle = (i / HUB_NODES.length) * Math.PI * 2 - Math.PI / 2;
              const cx = 400 + Math.cos(angle) * 290;
              const cy = 210 + Math.sin(angle) * 160;
              return (
                <g key={label}>
                  <line x1="400" y1="210" x2={cx} y2={cy} stroke="#E3DDEE" strokeWidth="1.5" />
                  <circle cx={cx} cy={cy} r="34" fill="#FFFFFF" stroke="#E8E8E8" strokeWidth="1.5" />
                  <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="#301C3F">
                    {label}
                  </text>
                </g>
              );
            })}
            <circle cx="400" cy="210" r="52" fill="url(#hubGrad)" />
            <defs>
              <linearGradient id="hubGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7C3AED" />
                <stop offset="55%" stopColor="#D946EF" />
                <stop offset="100%" stopColor="#FB923C" />
              </linearGradient>
            </defs>
            <circle cx="400" cy="210" r="24" fill="#FFFFFF" />
          </svg>
        </div>
      </section>

      {/* ============ Why we're different ============ */}
      <section id="different" className="px-6 py-24 lg:px-12">
        <h2 className="text-center text-4xl font-medium text-black md:text-5xl" style={{ letterSpacing: "-0.03em" }}>
          Why we&apos;re different
        </h2>
        <div className="mx-auto mt-12 max-w-4xl overflow-x-auto rounded-2xl border border-black/10 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-[#FAFAFB] text-left">
                <th className="px-5 py-3.5 font-medium text-black/50">Capability</th>
                <th className="px-5 py-3.5 font-semibold text-[#301C3F]">VoiceLine AI</th>
                <th className="px-5 py-3.5 font-medium text-black/50">Legacy IVR</th>
                <th className="px-5 py-3.5 font-medium text-black/50">Hiring more staff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {COMPARISON.map(([cap, us, ivr, staff]) => (
                <tr key={cap}>
                  <td className="px-5 py-3.5 font-medium text-black">{cap}</td>
                  <td className="px-5 py-3.5 font-semibold text-[#301C3F]">{us}</td>
                  <td className="px-5 py-3.5 text-black/60">{ivr}</td>
                  <td className="px-5 py-3.5 text-black/60">{staff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ============ Enterprise band (dark) ============ */}
      <section className="bg-[#0D0714] px-6 py-24 text-white lg:px-12">
        <h2 className="text-center text-4xl font-medium md:text-5xl" style={{ letterSpacing: "-0.03em" }}>
          Enterprise from day one
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-white/50">
          Security and isolation are the foundation, not an afterthought —
          with compliance controls arriving as your requirements grow.
        </p>
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {ENTERPRISE_CARDS.map((c) => (
            <div key={c.t} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <c.icon className="h-5 w-5 text-violet-300" strokeWidth={1.8} />
              <h3 className="mt-3 text-sm font-semibold">{c.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/50">{c.b}</p>
            </div>
          ))}
        </div>
        <p className="mt-14 text-center text-lg font-medium">One platform. Every call type.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          {CALL_TYPES.map((t) => (
            <span key={t} className="rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm text-white/80">
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* ============ Testimonials ============ */}
      <section className="bg-[#0D0714] px-6 pb-24 text-white lg:px-12">
        <h2 className="text-center text-3xl font-medium md:text-4xl" style={{ letterSpacing: "-0.03em" }}>
          Hear what our customers are saying
        </h2>
        <div className="mx-auto mt-10 grid max-w-6xl grid-cols-1 gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6">
              <blockquote className="flex-1 text-sm leading-relaxed text-white/80">“{t.quote}”</blockquote>
              <figcaption className="mt-5">
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-white/40">{t.role}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="px-6 py-24 lg:px-12">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 lg:grid-cols-3">
          <h2 className="text-4xl font-medium text-black" style={{ letterSpacing: "-0.03em" }}>
            We&apos;ve got
            <br />
            the answers
          </h2>
          <div className="space-y-3 lg:col-span-2">
            {FAQS.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-black/10 bg-white shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-4 text-sm font-medium text-black">
                  {f.q}
                  <span className="text-black/40 transition group-open:rotate-45">＋</span>
                </summary>
                <p className="border-t border-black/5 px-6 py-4 text-sm leading-relaxed text-black/60">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="px-6 pb-24 lg:px-12">
        <div className="grad-bg relative overflow-hidden rounded-3xl px-8 py-16 text-center shadow-2xl shadow-purple-500/20">
          <h2 className="text-3xl font-medium text-white md:text-5xl" style={{ letterSpacing: "-0.03em" }}>
            Voice AI with live
            <br />
            human supervision.
          </h2>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup"
              className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-semibold text-[#301C3F] transition hover:bg-white/90">
              Book a demo
            </Link>
            <Link href="/signup"
              className="inline-flex items-center justify-center rounded-full border border-white/50 px-8 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              Try an agent →
            </Link>
          </div>
        </div>
      </section>

      {/* ============ Footer with giant watermark ============ */}
      <footer className="relative overflow-hidden bg-[#0D0714] px-6 pt-16 text-white lg:px-12">
        <div className="grid grid-cols-2 gap-10 pb-16 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/media/logo.webp" alt="" className="h-7 w-7" />
              <span className="text-lg font-medium">VoiceLine AI</span>
            </div>
            <p className="mt-3 text-sm text-white/40">
              Enterprise voice AI with live human supervision.
            </p>
          </div>
          {[
            ["Solutions", ["Inbound support", "Outbound campaigns", "Scheduling", "Lead qualification"]],
            ["Features", ["AI Agents", "Live Monitoring", "Knowledge Bases", "Campaigns"]],
            ["Resources", ["Open Dashboard", "Book a demo", "FAQ", "Contact"]],
          ].map(([title, links]) => (
            <div key={title as string}>
              <p className="text-sm font-semibold text-white/80">{title}</p>
              <ul className="mt-3 space-y-2">
                {(links as string[]).map((l) => (
                  <li key={l}>
                    <Link href="/signup" className="text-sm text-white/40 transition hover:text-white">
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 py-6 text-xs text-white/30">
          © {new Date().getFullYear()} VoiceLine AI. All rights reserved.
        </div>
        {/* Giant watermark wordmark */}
        <div className="pointer-events-none select-none overflow-hidden pb-2" aria-hidden>
          <p className="whitespace-nowrap text-center text-[16vw] font-semibold leading-[0.8] text-white/5"
            style={{ letterSpacing: "-0.05em" }}>
            VoiceLine
          </p>
        </div>
      </footer>
    </div>
  );
}
