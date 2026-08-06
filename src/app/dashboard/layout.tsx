import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import NavLink from "@/components/dashboard/NavLink";

export const metadata = { title: "Dashboard — VoiceLine AI" };

const NAV = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/live", label: "Live monitoring" },
  { href: "/dashboard/agents", label: "Agents" },
  { href: "/dashboard/calls", label: "Call history" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-ink-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-ink-800 bg-ink-900/70 lg:flex">
        <Link href="/" className="flex h-16 items-center gap-2.5 border-b border-ink-800 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500 font-bold text-ink-950">
            V
          </span>
          <span className="font-semibold tracking-tight">VoiceLine AI</span>
        </Link>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
        <div className="border-t border-ink-800 px-5 py-4">
          <p className="truncate text-sm font-medium">{session.company}</p>
          <p className="truncate text-xs text-ink-400">{session.email}</p>
          <form action="/api/auth/logout" method="post" className="mt-3">
            <button className="text-xs font-medium text-ink-400 hover:text-signal-red">
              Log out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 lg:pl-60">
        {/* Mobile top bar */}
        <div className="flex h-14 items-center justify-between border-b border-ink-800 px-4 lg:hidden">
          <Link href="/dashboard" className="font-semibold">VoiceLine AI</Link>
          <nav className="flex gap-4 overflow-x-auto text-sm text-ink-300">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="whitespace-nowrap hover:text-ink-100">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <main className="container-page py-8 !max-w-5xl">{children}</main>
      </div>
    </div>
  );
}
