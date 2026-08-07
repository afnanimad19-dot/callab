"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Bot,
  LayoutDashboard,
  Phone,
  PhoneCall,
  Plug,
  Radio,
  Rocket,
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
  plug: Plug,
  webhook: Webhook,
};

export default function NavLink({
  href,
  label,
  icon,
  exact,
}: {
  href: string;
  label: string;
  icon?: string;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  const Icon = icon ? ICONS[icon] : undefined;

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
