"use client";

// Avatar dropdown in the dashboard header: workspace name, user identity,
// Settings link, Logout.

import { useState } from "react";
import Link from "next/link";
import { LogOut, Settings } from "lucide-react";

export default function ProfileMenu({
  name,
  email,
  company,
  initials,
}: {
  name: string;
  email: string;
  company: string;
  initials: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Account menu"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#301C3F] text-xs font-bold text-white transition hover:bg-[#3f2853]"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-64 overflow-hidden rounded-xl border border-ink-700 bg-white shadow-2xl shadow-black/10">
          <div className="border-b border-ink-700 px-4 py-3">
            <p className="truncate text-sm font-semibold">{company}</p>
          </div>
          <div className="border-b border-ink-700 px-4 py-3">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-ink-400">{email}</p>
          </div>
          <Link href="/dashboard/settings" onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-200 transition hover:bg-ink-800">
            <Settings className="h-4 w-4" /> Settings
          </Link>
          <form action="/api/auth/logout" method="post">
            <button className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink-200 transition hover:bg-ink-800">
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
