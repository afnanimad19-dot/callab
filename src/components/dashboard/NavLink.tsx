"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Bot,
  CalendarDays,
  Gem,
  Inbox,
  LayoutDashboard,
  Lock,
  Phone,
  PhoneCall,
  Plug,
  Radio,
  Rocket,
  ShieldCheck,
  Users,
  Webhook,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  bot: Bot,
  "book-open": BookOpen,
  rocket: Rocket,
  phone: Phone,
  users: Users,
  "phone-call": PhoneCall,
  radio: Radio,
  "calendar-days": CalendarDays,
  inbox: Inbox,
  plug: Plug,
  webhook: Webhook,
  gem: Gem,
  "bar-chart": BarChart3,
  shield: ShieldCheck,
};

export default function NavLink({
  href,
  label,
  icon,
  exact,
  locked,
}: {
  href: string;
  label: string;
  icon?: string;
  exact?: boolean;
  locked?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  const Icon = icon ? ICONS[icon] : undefined;

  // Locked (feature not in the plan): not a link to the feature — clicking
  // routes to Plans to upgrade, and the label carries a lock.
  if (locked) {
    return (
      <Link
        href="/dashboard/plans"
        title="Upgrade your plan to unlock this"
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-400/70 transition hover:bg-ink-800/60"
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />}
        <span className="flex-1">{label}</span>
        <Lock className="h-3.5 w-3.5 shrink-0 text-ink-400" />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-[#F0EAF7] font-semibold text-[#301C3F]"
          : "text-ink-300 hover:bg-ink-800 hover:text-ink-100"
      }`}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />}
      {label}
    </Link>
  );
}
