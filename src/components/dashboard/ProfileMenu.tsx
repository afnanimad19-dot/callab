"use client";

// Avatar dropdown in the dashboard header: workspace name, user identity,
// light/dark theme switch, Settings link, Logout.

import { useState } from "react";
import Link from "next/link";

function applyTheme(theme: "light" | "dark") {
  if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
  try {
    localStorage.setItem("theme", theme);
  } catch {}
}

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
        className="grad-bg flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white transition hover:brightness-110"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-64 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-2xl shadow-black/40">
          <div className="border-b border-ink-700 px-4 py-3">
            <p className="truncate text-sm font-semibold">{company}</p>
          </div>
          <div className="border-b border-ink-700 px-4 py-3">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-ink-400">{email}</p>
          </div>
          <div className="flex items-center justify-center gap-2 border-b border-ink-700 px-4 py-3">
            <button onClick={() => applyTheme("light")} title="Light mode"
              className="flex h-8 w-10 items-center justify-center rounded-lg border border-ink-600 transition hover:bg-ink-800">☀️</button>
            <button onClick={() => applyTheme("dark")} title="Dark mode"
              className="flex h-8 w-10 items-center justify-center rounded-lg border border-ink-600 transition hover:bg-ink-800">🌙</button>
          </div>
          <Link href="/dashboard/settings" onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-ink-200 transition hover:bg-ink-800">
            ⚙ Settings
          </Link>
          <form action="/api/auth/logout" method="post">
            <button className="block w-full px-4 py-2.5 text-left text-sm text-ink-200 transition hover:bg-ink-800">
              Logout
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
