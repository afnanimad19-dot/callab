"use client";

// Settings with a horizontal tab bar: Profile, Users, API Keys,
// Preferences, Billing, Workspaces.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const TABS = ["Profile", "Users", "API Keys", "Preferences", "Billing", "Workspaces"] as const;
type Tab = (typeof TABS)[number];

interface SessionInfo {
  name: string;
  email: string;
  company: string;
  createdAt?: string;
}

export default function SettingsTabs({ session }: { session: SessionInfo }) {
  const [tab, setTab] = useState<Tab>("Profile");

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="card flex flex-wrap gap-1 !p-1.5">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              tab === t ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:text-ink-200"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Profile" && <ProfileTab session={session} />}
      {tab === "Users" && <UsersTab session={session} />}
      {tab === "API Keys" && <ApiKeysTab />}
      {tab === "Preferences" && <PreferencesTab />}
      {tab === "Billing" && <BillingTab />}
      {tab === "Workspaces" && <WorkspacesTab session={session} />}
    </div>
  );
}

function ProfileTab({ session }: { session: SessionInfo }) {
  const router = useRouter();
  const [name, setName] = useState(session.name);
  const [company, setCompany] = useState(session.company);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, company }),
    });
    setMsg(res.ok ? "Profile updated." : "Could not save changes.");
    if (res.ok) router.refresh();
    setBusy(false);
  }

  return (
    <div className="card max-w-xl !p-7">
      <h2 className="text-base font-semibold">Profile</h2>
      <p className="mt-0.5 text-sm text-ink-400">Your personal and company details.</p>
      <div className="mt-5 space-y-4">
        <div>
          <label className="label">Your name</label>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Company</label>
          <input className="field" value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="field opacity-60" value={session.email} disabled />
        </div>
        {msg && <p className="text-sm text-accent-300">{msg}</p>}
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function UsersTab({ session }: { session: SessionInfo }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500">🔍</span>
          <input className="field !pl-10" placeholder="Search users..." />
        </div>
        <button className="btn-primary"
          onClick={() => alert("Team invites arrive with roles (owner / supervisor / viewer) in the teams phase.")}>
          + Add User
        </button>
      </div>
      <div className="card flex items-center justify-between !p-5">
        <div className="flex items-center gap-4">
          <span className="grad-bg flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white">
            {session.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
          </span>
          <div>
            <p className="text-sm font-semibold">{session.name}</p>
            <p className="text-xs text-ink-400">{session.email}</p>
            <p className="mt-0.5 text-xs text-ink-500">🗓 Created {session.createdAt ?? "—"}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-950">Owner</span>
          <span className="badge-ok">Active</span>
        </div>
      </div>
    </div>
  );
}

function ApiKeysTab() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/api-key", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.apiKey) setApiKey(data.apiKey);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-5">
      <div className="card !p-7">
        <h2 className="text-base font-semibold">API Key Management</h2>
        <p className="mt-0.5 text-sm text-ink-400">
          Manage your API key for accessing our services programmatically
        </p>
        <div className="mt-5 flex items-center justify-between">
          <p className="text-sm font-medium">🔑 Your API Key</p>
          <span className="badge-ok">Active</span>
        </div>
        <div className="mt-2 flex gap-2">
          <input readOnly className="field font-mono !text-[13px]"
            value={apiKey ? (revealed ? apiKey : "•".repeat(38)) : "Loading…"} />
          <button onClick={() => setRevealed(!revealed)} className="btn-secondary !px-3.5" aria-label="Reveal">
            👁
          </button>
          <button className="btn-secondary"
            onClick={async () => {
              if (!apiKey) return;
              await navigator.clipboard.writeText(apiKey);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}>
            {copied ? "✓ Copied" : "⧉ Copy"}
          </button>
        </div>
        <p className="mt-4 rounded-lg border border-ink-700 bg-ink-800/60 px-4 py-3 text-sm text-ink-300">
          🛡 <strong className="text-ink-100">Keep your API key secure!</strong> This key
          provides access to your account data. Never share it publicly or include it
          in client-side code.
        </p>
      </div>
      <div className="card !p-7">
        <h2 className="text-base font-semibold">API Usage Guidelines</h2>
        <p className="mt-0.5 text-sm text-ink-400">Best practices for using your API key</p>
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold">🛡 Security Best Practices</p>
            <ul className="mt-2 space-y-1 text-sm text-ink-300">
              <li>· Store securely in environment variables</li>
              <li>· Never commit to version control</li>
              <li>· Use HTTPS for all API requests</li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold">🔑 Authentication</p>
            <ul className="mt-2 space-y-1 text-sm text-ink-300">
              <li>· Include in Authorization header</li>
              <li>· Format: Bearer {"{your-api-key}"}</li>
              <li>· Monitor usage in dashboard</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreferencesTab() {
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifEscalation, setNotifEscalation] = useState(true);

  function setTheme(theme: "light" | "dark") {
    if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
    try { localStorage.setItem("theme", theme); } catch {}
  }

  return (
    <div className="card max-w-xl !p-7">
      <h2 className="text-base font-semibold">Preferences</h2>
      <div className="mt-5 space-y-5">
        <div>
          <label className="label">Theme</label>
          <div className="flex gap-2">
            <button onClick={() => setTheme("light")} className="btn-secondary">☀️ Light</button>
            <button onClick={() => setTheme("dark")} className="btn-secondary">🌙 Dark</button>
          </div>
        </div>
        <label className="flex items-center justify-between rounded-xl border border-ink-700 px-4 py-3 text-sm">
          <span>Email me a daily call summary</span>
          <input type="checkbox" className="h-4 w-4 accent-accent-500"
            checked={notifEmail} onChange={(e) => setNotifEmail(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between rounded-xl border border-ink-700 px-4 py-3 text-sm">
          <span>Notify me when a call is escalated to a human</span>
          <input type="checkbox" className="h-4 w-4 accent-accent-500"
            checked={notifEscalation} onChange={(e) => setNotifEscalation(e.target.checked)} />
        </label>
        <p className="text-xs text-ink-500">
          Notification delivery activates alongside live call events.
        </p>
      </div>
    </div>
  );
}

function BillingTab() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="card !p-7">
        <h2 className="text-base font-semibold">Current Plan</h2>
        <p className="mt-3 text-2xl font-bold">Developer preview</p>
        <p className="mt-1 text-sm text-ink-400">
          All features unlocked while you build. Paid plans with per-minute
          billing arrive with the Stripe phase.
        </p>
      </div>
      <div className="card !p-7">
        <h2 className="text-base font-semibold">Minutes Balance</h2>
        <div className="mt-3 flex items-end justify-between">
          <p className="text-2xl font-bold">9,986</p>
          <p className="text-sm text-ink-400">of 10,000 min</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-800">
          <div className="grad-bg h-full w-[99%] rounded-full" />
        </div>
      </div>
    </div>
  );
}

function WorkspacesTab({ session }: { session: SessionInfo }) {
  return (
    <div className="card max-w-xl !p-7">
      <h2 className="text-base font-semibold">Workspaces</h2>
      <p className="mt-0.5 text-sm text-ink-400">
        Each workspace has its own agents, numbers, contacts and call history.
      </p>
      <div className="mt-5 flex items-center justify-between rounded-xl border border-ink-700 px-4 py-3.5">
        <div>
          <p className="text-sm font-semibold">{session.company}</p>
          <p className="text-xs text-ink-400">Default workspace</p>
        </div>
        <span className="badge-ok">Current</span>
      </div>
      <button className="btn-secondary mt-4"
        onClick={() => alert("Multiple workspaces arrive with the teams phase.")}>
        + New workspace
      </button>
    </div>
  );
}
