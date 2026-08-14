import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { findUserById } from "@/lib/db";
import { planFeature, getPlanTier } from "@/lib/plans";
import { isPlatformAdmin } from "@/lib/admin";
import NavLink from "@/components/dashboard/NavLink";
import ProfileMenu from "@/components/dashboard/ProfileMenu";
import ToastHost from "@/components/Toast";
import { getUsage } from "@/lib/usage";

export const metadata = { title: "Dashboard — VoiceLine AI" };

const NAV_GROUPS: {
  heading: string | null;
  items: { href: string; label: string; icon: string; exact?: boolean; feature?: "outbound" }[];
}[] = [
  {
    heading: null,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "layout-dashboard", exact: true },
      { href: "/dashboard/inbox", label: "Inbox", icon: "inbox" },
    ],
  },
  {
    heading: "AI & Knowledge",
    items: [
      { href: "/dashboard/agents", label: "AI Agents", icon: "bot" },
      { href: "/dashboard/knowledge", label: "Knowledge Bases", icon: "book-open" },
      { href: "/dashboard/launch", label: "Launch your AI", icon: "rocket", feature: "outbound" },
    ],
  },
  {
    heading: "Communication",
    items: [
      { href: "/dashboard/phone-numbers", label: "Phone Numbers", icon: "phone" },
      { href: "/dashboard/contacts", label: "Contacts", icon: "users" },
      { href: "/dashboard/calls", label: "Call Logs", icon: "phone-call" },
      { href: "/dashboard/calendar", label: "Calendar", icon: "calendar-days" },
      { href: "/dashboard/reports", label: "Reports", icon: "bar-chart" },
      { href: "/dashboard/live", label: "Live Monitoring", icon: "radio" },
    ],
  },
  {
    heading: "Connections",
    items: [
      { href: "/dashboard/integrations", label: "Integrations", icon: "plug" },
      { href: "/dashboard/webhooks", label: "Webhooks", icon: "webhook" },
    ],
  },
  {
    heading: "Account",
    items: [{ href: "/dashboard/plans", label: "Plans", icon: "gem" }],
  },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Plan gating: mark nav items whose feature the current plan doesn't include
  // so they render as locked (non-navigating) and route to Plans on click.
  const user = await findUserById(session.userId);
  const outbound = planFeature(user, "outbound");
  const isLocked = (feature?: "outbound") => (feature === "outbound" ? !outbound : false);

  const usage = await getUsage(session.userId);
  const planName = getPlanTier(user).name;
  const barColor = usage.over ? "bg-signal-red" : usage.pct >= 80 ? "bg-signal-amber" : "grad-bg";

  // Platform admins get an extra oversight section.
  const navGroups: typeof NAV_GROUPS = isPlatformAdmin(session.email)
    ? [...NAV_GROUPS, { heading: "Platform", items: [{ href: "/dashboard/admin", label: "Admin", icon: "shield" }] }]
    : NAV_GROUPS;

  const initials = session.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-ink-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-ink-700 bg-[#FBF9FE] lg:flex">
        <Link href="/" className="flex h-16 items-center gap-2.5 px-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/media/logo.webp" alt="" className="h-8 w-8" />
          <span className="text-[17px] font-semibold tracking-tight">
            <span className="font-bold">Voice</span>Line AI
          </span>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {navGroups.map((group, gi) => (
            <div key={gi} className="mt-3">
              {group.heading && (
                <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  {group.heading}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink key={item.href} {...item} locked={isLocked(item.feature)} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-3 border-t border-ink-700 px-4 py-4">
          <div className="flex items-center justify-between rounded-lg border border-ink-700 px-3 py-2">
            <span className="truncate text-sm font-medium">{session.company}</span>
            <span className="text-ink-400">▾</span>
          </div>
          <Link href="/dashboard/settings?tab=billing" className="block rounded-lg border border-ink-700 px-3 py-2.5 transition hover:border-ink-500">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-400">Voice minutes · {planName}</span>
              <span className={`font-semibold ${usage.over ? "text-signal-red" : ""}`}>
                {usage.remainingMinutes.toLocaleString()} / {usage.totalMinutes.toLocaleString()}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-800">
              <div className={`${barColor} h-full rounded-full transition-all`} style={{ width: `${Math.max(2, 100 - usage.pct)}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-ink-400">
              {usage.over
                ? "Out of minutes — top up to keep calling"
                : `${usage.usedMinutes.toLocaleString()} min used this cycle · tap to top up`}
            </p>
          </Link>
          <div className="flex items-center justify-between px-1">
            <Link
              href="/dashboard/settings"
              className="text-sm font-medium text-ink-300 hover:text-ink-100"
            >
              Settings
            </Link>
            <form action="/api/auth/logout" method="post">
              <button className="text-xs font-medium text-ink-400 hover:text-signal-red">
                Log out
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex-1 lg:pl-60">
        <header className="app-header sticky top-0 z-20 flex h-14 items-center justify-between border-b border-ink-700 bg-ink-950/85 px-6 backdrop-blur lg:justify-end lg:px-10">
          <Link href="/dashboard" className="font-semibold lg:hidden">
            VoiceLine AI
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-400 sm:block">{session.email}</span>
            <ProfileMenu
              name={session.name}
              email={session.email}
              company={session.company}
              initials={initials}
            />
          </div>
        </header>

        {/* Mobile nav */}
        <div className="flex gap-4 overflow-x-auto border-b border-ink-700 bg-ink-900 px-4 py-2.5 text-sm text-ink-300 lg:hidden">
          {navGroups.flatMap((g) => g.items).map((item) =>
            isLocked(item.feature) ? (
              <Link key={item.href} href="/dashboard/plans" className="flex items-center gap-1 whitespace-nowrap text-ink-500">
                🔒 {item.label}
              </Link>
            ) : (
              <Link key={item.href} href={item.href} className="whitespace-nowrap hover:text-ink-100">
                {item.label}
              </Link>
            )
          )}
        </div>

        {/* Full-width main content — pages own the whole canvas like a real
            SaaS console; no artificial center column. */}
        <main className="w-full px-6 py-8 lg:px-10">{children}</main>
      </div>
      <ToastHost />
    </div>
  );
}
