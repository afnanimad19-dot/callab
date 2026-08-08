"use client";

// Settings with a horizontal tab bar: Profile, Users, API Keys,
// Preferences, Billing, Workspaces.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Users as UsersIcon,
  Calendar,
  ShieldCheck,
  Copy,
  Check,
  Ban,
  UserCheck,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "@/components/Toast";
import BillingTab from "./BillingTab";
import ChannelsTab from "./ChannelsTab";

const TABS = ["Profile", "Users", "API Keys", "Preferences", "Billing", "Channels", "Workspaces"] as const;
type Tab = (typeof TABS)[number];

interface SessionInfo {
  name: string;
  email: string;
  company: string;
  createdAt?: string;
}

export default function SettingsTabs({
  session,
  showResetBanner,
}: {
  session: SessionInfo;
  showResetBanner?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("Profile");

  return (
    <div className="space-y-6">
      {showResetBanner && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Welcome! You logged in with a temporary password — set your own one below under
          &ldquo;Change password&rdquo;.
        </p>
      )}
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
      {tab === "Channels" && <ChannelsTab />}
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
    if (res.ok) {
      toast("Profile updated.");
      router.refresh();
    }
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

      <ChangePasswordSection />
    </div>
  );
}

function ChangePasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function change() {
    if (next !== confirm) {
      setMsg({ ok: false, text: "New passwords don't match." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/settings/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(
      res.ok
        ? { ok: true, text: "Password updated." }
        : { ok: false, text: data.error ?? "Could not change password." }
    );
    if (res.ok) {
      setCurrent("");
      setNext("");
      setConfirm("");
    }
    setBusy(false);
  }

  return (
    <div className="mt-8 border-t border-ink-700 pt-6">
      <h3 className="text-sm font-semibold">Change password</h3>
      <p className="mt-0.5 text-xs text-ink-400">
        If you logged in with a temporary password, set your own one here.
      </p>
      <div className="mt-4 space-y-3">
        <input
          className="field"
          type="password"
          placeholder="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="field"
            type="password"
            placeholder="New password (min 8 chars)"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <input
            className="field"
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {msg && (
          <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-signal-red"}`}>{msg.text}</p>
        )}
        <button
          onClick={change}
          disabled={busy || !current || !next}
          className="btn-secondary disabled:opacity-50"
        >
          {busy ? "Updating…" : "Update password"}
        </button>
      </div>
    </div>
  );
}

interface Member {
  id: string;
  name: string;
  email: string;
  role: "owner" | "supervisor" | "viewer";
  status: "active" | "invited" | "blocked";
  emailVerified: boolean;
  createdAt: string;
}

function UsersTab({ session }: { session: SessionInfo }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState("");
  const [showInvite, setShowInvite] = useState(false);

  async function load() {
    const res = await fetch("/api/settings/users");
    if (res.ok) setMembers((await res.json()).members ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  const me = members.find((m) => m.email === session.email);
  const isOwner = !me || me.role === "owner";
  const q = query.trim().toLowerCase();
  const visible = members.filter(
    (m) => !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
  );

  async function setRole(m: Member, role: string) {
    await fetch("/api/settings/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: m.id, role }),
    });
    toast(`${m.name} is now a ${role}.`);
    load();
  }
  async function setStatus(m: Member, status: string) {
    await fetch("/api/settings/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: m.id, status }),
    });
    toast(status === "blocked" ? `${m.name} blocked.` : `${m.name} unblocked.`);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500">
            <Search className="h-4 w-4" />
          </span>
          <input
            className="field !pl-10"
            placeholder="Search users..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {isOwner && (
          <button className="btn-primary" onClick={() => setShowInvite(true)}>
            + Add User
          </button>
        )}
      </div>

      {visible.map((m) => (
        <div key={m.id} className="card flex flex-wrap items-center justify-between gap-4 !p-5">
          <div className="flex items-center gap-4">
            <span className="grad-bg flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white">
              {m.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <div>
              <p className="text-sm font-semibold">
                {m.name}
                {m.email === session.email && <span className="ml-2 text-xs text-ink-400">(you)</span>}
              </p>
              <p className="text-xs text-ink-400">{m.email}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-500">
                <Calendar className="h-3 w-3" />
                Created {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "—"}
                {!m.emailVerified && <span className="text-amber-600">· email not verified</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {m.role === "owner" ? (
              <span className="rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-950">Owner</span>
            ) : isOwner ? (
              <select
                value={m.role}
                onChange={(e) => setRole(m, e.target.value)}
                className="field w-32 !py-1.5 !text-xs"
              >
                <option value="supervisor">Supervisor</option>
                <option value="viewer">Viewer</option>
              </select>
            ) : (
              <span className="badge-muted capitalize">{m.role}</span>
            )}
            <span
              className={
                m.status === "active" ? "badge-ok" : m.status === "invited" ? "badge-warn" : "badge-bad"
              }
            >
              {m.status}
            </span>
            {isOwner && m.role !== "owner" && (
              <button
                onClick={() => setStatus(m, m.status === "blocked" ? "active" : "blocked")}
                title={m.status === "blocked" ? "Unblock user" : "Block user"}
                className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"
              >
                {m.status === "blocked" ? <UserCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      ))}
      {members.length === 0 && (
        <div className="card !p-8 text-center text-sm text-ink-400">Loading team…</div>
      )}

      {showInvite && (
        <InviteUserModal
          onClose={() => setShowInvite(false)}
          onInvited={() => {
            load();
          }}
        />
      )}
    </div>
  );
}

function InviteUserModal({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRoleValue] = useState("supervisor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ emailed: boolean; tempPassword?: string; verifyUrl?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function invite() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invite failed");
      setResult(data);
      onInvited();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-ink-700 bg-ink-950 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <UsersIcon className="h-4 w-4 text-ink-400" /> Add User
        </h2>
        {!result ? (
          <>
            <p className="mt-1 text-sm text-ink-400">
              They&apos;ll receive a verification email and a temporary password to log in with.
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="label">Email</label>
                <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" />
              </div>
              <div>
                <label className="label">Name</label>
                <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="field" value={role} onChange={(e) => setRoleValue(e.target.value)}>
                  <option value="supervisor">Supervisor — can manage agents & take over calls</option>
                  <option value="viewer">Viewer — read-only access</option>
                </select>
              </div>
              {error && <p className="text-sm text-signal-red">{error}</p>}
              <div className="flex justify-end gap-2">
                <button className="btn-secondary" onClick={onClose}>Cancel</button>
                <button className="btn-primary disabled:opacity-50" disabled={busy || !email} onClick={invite}>
                  {busy ? "Inviting…" : "Send invite"}
                </button>
              </div>
            </div>
          </>
        ) : result.emailed ? (
          <>
            <p className="mt-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Invitation sent! {email} will get a verification link and a temporary password by email.
            </p>
            <div className="mt-4 flex justify-end">
              <button className="btn-primary" onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-800">
              Email sending isn&apos;t configured yet (set RESEND_API_KEY). Share these details with them directly — they work exactly the same:
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <p className="flex items-center justify-between rounded-lg bg-ink-800 px-3 py-2">
                <span className="text-ink-400">Temporary password</span>
                <code className="font-mono">{result.tempPassword}</code>
              </p>
              <p className="rounded-lg bg-ink-800 px-3 py-2">
                <span className="text-ink-400">Verification link</span>
                <span className="mt-1 block break-all font-mono text-xs">{result.verifyUrl}</span>
              </p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="btn-secondary flex items-center gap-1.5"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    `Login: ${email}\nTemporary password: ${result.tempPassword}\nVerify: ${result.verifyUrl}`
                  );
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy details"}
              </button>
              <button className="btn-primary" onClick={onClose}>Done</button>
            </div>
          </>
        )}
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
          <p className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4 text-ink-400" /> Your API Key
          </p>
          <span className="badge-ok">Active</span>
        </div>
        <div className="mt-2 flex gap-2">
          <input readOnly className="field font-mono !text-[13px]"
            value={apiKey ? (revealed ? apiKey : "•".repeat(38)) : "Loading…"} />
          <button onClick={() => setRevealed(!revealed)} className="btn-secondary !px-3.5" aria-label="Reveal">
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button className="btn-secondary flex items-center gap-1.5"
            onClick={async () => {
              if (!apiKey) return;
              await navigator.clipboard.writeText(apiKey);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-ink-700 bg-ink-800/60 px-4 py-3 text-sm text-ink-300">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
          <span>
            <strong className="text-ink-100">Keep your API key secure!</strong> This key
            provides access to your account data. Never share it publicly or include it
            in client-side code.
          </span>
        </p>
      </div>
      <div className="card !p-7">
        <h2 className="text-base font-semibold">API Usage Guidelines</h2>
        <p className="mt-0.5 text-sm text-ink-400">Best practices for using your API key</p>
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-ink-400" /> Security Best Practices
            </p>
            <ul className="mt-2 space-y-1 text-sm text-ink-300">
              <li>· Store securely in environment variables</li>
              <li>· Never commit to version control</li>
              <li>· Use HTTPS for all API requests</li>
            </ul>
          </div>
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound className="h-4 w-4 text-ink-400" /> Authentication
            </p>
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

  return (
    <div className="card max-w-xl !p-7">
      <h2 className="text-base font-semibold">Preferences</h2>
      <div className="mt-5 space-y-5">
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
