import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Premium light landing page. Deliberately fixed to its own light palette
// (#F5F5F5) independent of the dashboard theme toggle — the marketing site
// has one designed look. Media panels use animated aurora gradients; swap
// the .aurora divs for <video> elements when you have brand footage.

function LogoIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" className={className} fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M64 0h128c35.3 0 64 28.7 64 64v128c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V64C0 28.7 28.7 0 64 0Zm64 72a56 56 0 1 0 0 112 56 56 0 0 0 0-112Zm0 30a26 26 0 1 1 0 52 26 26 0 0 1 0-52Z"
      />
    </svg>
  );
}

function PillButton({
  href,
  children,
  large = false,
}: {
  href: string;
  children: React.ReactNode;
  large?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-3 rounded-full bg-black font-medium text-white transition-colors duration-200 hover:bg-gray-800 ${
        large ? "py-2 pl-8 pr-2 text-base md:text-lg" : "py-1.5 pl-7 pr-1.5 text-base"
      }`}
    >
      {children}
      <span className="rounded-full bg-white p-2">
        <ArrowRight className="h-5 w-5 text-black" />
      </span>
    </Link>
  );
}

// Partner marquee — varied typographic treatments per brand for an
// organic "many logos" feel without image assets.
const BRANDS: { name: string; style: React.CSSProperties }[] = [
  { name: "Asterisk", style: { fontFamily: "Georgia, serif", fontWeight: 700, letterSpacing: "-0.02em", fontSize: 15 } },
  { name: "NORTHDUET", style: { fontFamily: "Arial, sans-serif", fontWeight: 900, letterSpacing: "0.08em", fontSize: 13 } },
  { name: "Nectar", style: { fontFamily: "'Trebuchet MS', sans-serif", fontWeight: 600, letterSpacing: "0.01em", fontSize: 15, fontStyle: "italic" } },
  { name: "OASIS", style: { fontFamily: "'Courier New', monospace", fontWeight: 700, letterSpacing: "0.12em", fontSize: 13 } },
  { name: "Cloudform", style: { fontFamily: "Palatino, 'Book Antiqua', serif", fontWeight: 400, letterSpacing: "-0.01em", fontSize: 16 } },
  { name: "OHealth", style: { fontFamily: "Impact, 'Arial Narrow', sans-serif", fontWeight: 400, letterSpacing: "0.04em", fontSize: 14 } },
  { name: "FastAid", style: { fontFamily: "Verdana, sans-serif", fontWeight: 700, letterSpacing: "-0.03em", fontSize: 13 } },
];

const BACKERS: { name: string; style: React.CSSProperties }[] = [
  { name: "Fundamental Labs", style: { fontFamily: "'Times New Roman', serif", fontWeight: 400, letterSpacing: "0.02em", fontSize: 14 } },
  { name: "MAINPOINT", style: { fontFamily: "'Arial Black', sans-serif", fontWeight: 900, letterSpacing: "0.08em", fontSize: 16 } },
  { name: "NGC", style: { fontFamily: "Impact, sans-serif", fontWeight: 700, letterSpacing: "0.05em", fontSize: 18 } },
  { name: "NxGen", style: { fontFamily: "Georgia, serif", fontWeight: 600, letterSpacing: "-0.02em", fontSize: 17 } },
  { name: "Veterinary Co", style: { fontFamily: "Helvetica, sans-serif", fontWeight: 700, letterSpacing: "-0.01em", fontSize: 15 } },
  { name: "DIALTOOLS", style: { fontFamily: "Verdana, sans-serif", fontWeight: 700, letterSpacing: "0.06em", fontSize: 14 } },
  { name: "NGRAVE", style: { fontFamily: "'Courier New', monospace", fontWeight: 700, letterSpacing: "0.18em", fontSize: 14 } },
  { name: "Polyline", style: { fontFamily: "Palatino, serif", fontWeight: 500, letterSpacing: "0.03em", fontSize: 15 } },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col bg-[#F5F5F5]" style={{ colorScheme: "light" }}>
      {/* ============ Screen 1: Navbar + Hero ============ */}
      <div className="flex h-screen flex-col overflow-hidden">
        <nav className="absolute left-0 right-0 top-0 z-20 px-6 py-5">
          <div className="mx-auto flex max-w-[88rem] items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <LogoIcon className="h-7 w-7 text-black" />
              <span className="text-2xl font-medium tracking-tight text-black">VoiceLine</span>
            </Link>
            <div className="hidden items-center gap-8 md:flex">
              {[
                ["#product", "Product"],
                ["#features", "Features"],
                ["#backers", "Partners"],
                ["#use-cases", "Use cases"],
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

        {/* Hero */}
        <section className="flex flex-1 items-end px-6 pb-6 pt-20">
          <div className="relative mx-auto w-full max-w-[88rem] overflow-hidden rounded-2xl"
            style={{ height: "calc(100vh - 96px)" }}>
            {/* Media backdrop — generated brand visual over the aurora base */}
            <div className="aurora absolute inset-0" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/media/hero.webp" alt=""
              className="absolute inset-0 h-full w-full object-cover" />
            {/* Legibility wash behind the headline */}
            <div className="absolute inset-0"
              style={{ background: "linear-gradient(105deg, rgba(245,245,245,0.82) 0%, rgba(245,245,245,0.45) 38%, rgba(245,245,245,0) 62%)" }} />
            {/* Live animated soundbar */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex h-40 items-end justify-center gap-1 px-8 opacity-40" aria-hidden>
              {Array.from({ length: 80 }, (_, i) => (
                <span key={i} className="w-1 animate-wave rounded-full bg-black/40"
                  style={{
                    height: `${18 + 60 * Math.abs(Math.sin(i * 0.5))}%`,
                    transformOrigin: "bottom",
                    animationDelay: `${(i % 12) * 0.12}s`,
                    animationDuration: `${1.4 + (i % 5) * 0.18}s`,
                  }} />
              ))}
            </div>

            <div className="relative z-10 flex h-full flex-col items-start justify-start p-12 pt-36">
              <h1 className="mb-4 max-w-xl text-5xl font-medium leading-tight text-black md:text-6xl"
                style={{ letterSpacing: "-0.04em" }}>
                Your Phones
                <br />
                Answered
              </h1>
              <p className="mb-8 max-w-md text-base leading-relaxed text-black/70 md:text-lg"
                style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>
                Automated, human-supervised voice agents that answer, schedule
                and qualify on your existing lines — while your team watches
                every word live.
              </p>
              <PillButton href="/signup" large>Join us</PillButton>

              {/* Brand marquee */}
              <div className="mt-24 w-full max-w-md overflow-hidden">
                <div className="marquee-track">
                  {[...BRANDS, ...BRANDS].map((b, i) => (
                    <span key={i} className="mx-7 shrink-0 whitespace-nowrap text-black/60" style={b.style}>
                      {b.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ============ Info Section ============ */}
      <section id="product" className="bg-[#F5F5F5] px-6 py-24">
        <div className="mx-auto max-w-[88rem]">
          <div className="mb-16 grid grid-cols-1 items-start gap-12 md:grid-cols-2">
            <div>
              <h2 className="mb-8 text-4xl font-medium leading-tight text-black md:text-5xl"
                style={{ letterSpacing: "-0.03em" }}>
                Meet VoiceLine AI.
              </h2>
              <PillButton href="/signup">Discover it</PillButton>
            </div>
            <p className="text-2xl leading-relaxed text-black/70 md:text-3xl">
              VoiceLine is a supervised voice agent platform that answers every
              call for your business while your team stays in command of every
              conversation.
            </p>
          </div>

          <div id="features" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1 — media card, spans 2 */}
            <div className="relative overflow-hidden rounded-2xl lg:col-span-2">
              <div className="aurora-cool absolute inset-0" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/media/bloom.webp" alt=""
                className="absolute inset-0 h-full w-full object-cover" />
              <div className="relative flex min-h-80 flex-col justify-between p-7">
                <h3 className="text-2xl font-medium leading-snug text-black" style={{ letterSpacing: "-0.02em" }}>
                  Calls that convert
                </h3>
                <p className="max-w-xs text-base text-black/70">
                  Every ring answered in seconds — appointments booked, leads
                  qualified and questions resolved before voicemail ever picks up.
                </p>
              </div>
            </div>

            {/* Card 2 — solid */}
            <div className="flex min-h-80 flex-col justify-between rounded-2xl bg-[#2B2644] p-7">
              <h3 className="text-2xl font-medium leading-snug text-white" style={{ letterSpacing: "-0.02em" }}>
                Always live,
                <br />
                always supervised.
              </h3>
              <p className="text-base text-white/60">
                Watch streaming transcripts with sentiment scores, and take over
                any call in one click — the caller never notices the switch.
              </p>
            </div>

            {/* Card 3 — solid */}
            <div className="flex min-h-80 flex-col justify-between rounded-2xl bg-[#2B2644] p-7">
              <h3 className="text-2xl font-medium leading-snug text-white" style={{ letterSpacing: "-0.02em" }}>
                Fully
                <br />
                automated
              </h3>
              <p className="text-base text-white/60">
                Skip staffing the phone line yourself. VoiceLine answers,
                summarizes and syncs outcomes in the background for you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Backed By ============ */}
      <section id="backers" className="bg-[#F5F5F5] px-6">
        <div className="mx-auto grid max-w-[88rem] grid-cols-1 items-center gap-8 md:grid-cols-4">
          <p className="text-base leading-relaxed text-black/70">
            Trusted by growing teams
            <br />
            and forward-thinking operators.
          </p>
          <div className="overflow-hidden md:col-span-3">
            <div className="backers-track">
              {[...BACKERS, ...BACKERS].map((b, i) => (
                <span key={i} className="mx-10 shrink-0 whitespace-nowrap text-black/50" style={b.style}>
                  {b.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ Use Cases ============ */}
      <section id="use-cases" className="bg-[#F5F5F5] px-6 py-24">
        <div className="mx-auto grid max-w-[88rem] grid-cols-1 items-start gap-8 md:grid-cols-2">
          <div className="md:pr-12 md:pt-2">
            <p className="mb-2 text-sm text-black/60">VoiceLine in Practice</p>
            <h2 className="mb-6 text-5xl font-medium leading-none text-black md:text-6xl"
              style={{ letterSpacing: "-0.04em" }}>
              Use modes
            </h2>
            <p className="max-w-sm text-base leading-relaxed text-black/60">
              VoiceLine powers a wide range of modes for clinics, agencies and
              service businesses wanting safe, supervised voice automation on
              their phone lines — plus more
            </p>
          </div>

          <div className="relative min-h-[720px] overflow-hidden rounded-3xl">
            <div className="aurora absolute inset-0" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/media/equalizer.webp" alt=""
              className="absolute inset-0 h-full w-full object-cover" />
            <div className="relative z-10 p-10 md:p-12">
              <h3 className="mb-5 text-4xl font-medium leading-tight text-black md:text-5xl"
                style={{ letterSpacing: "-0.03em" }}>
                Front Desk
              </h3>
              <p className="mb-8 max-w-md text-base text-black/70">
                Lift customer satisfaction by answering every call instantly —
                bookings, reschedules and questions handled with zero hold
                time, and a human supervisor one click away on your platform.
              </p>
              <Link href="/signup" className="group inline-flex items-center gap-3 text-base font-medium text-black">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 backdrop-blur transition-colors group-hover:bg-white">
                  <ArrowRight className="h-4 w-4 text-black" />
                </span>
                Know more
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Footer ============ */}
      <footer className="bg-[#F5F5F5] px-6 pb-10">
        <div className="mx-auto flex max-w-[88rem] flex-col items-center justify-between gap-4 border-t border-black/10 pt-8 sm:flex-row">
          <div className="flex items-center gap-2">
            <LogoIcon className="h-5 w-5 text-black" />
            <span className="text-sm font-medium text-black">VoiceLine AI</span>
          </div>
          <p className="text-xs text-black/50">
            © {new Date().getFullYear()} VoiceLine AI · Voice agents with live human supervision.
          </p>
        </div>
      </footer>
    </div>
  );
}
