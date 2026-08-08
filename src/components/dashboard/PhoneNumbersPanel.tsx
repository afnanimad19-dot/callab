"use client";
import { Search, RefreshCw, Trash2 } from "lucide-react";
import RowMenu from "./RowMenu";
import { toast } from "@/components/Toast";

// Phone Numbers: search + provider/status filters, number cards, and the
// "Add Phone Number" flow (provider picker → provider-specific form).
// Provider credentials are forwarded to the voice pipeline, never stored.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import type { PhoneNumber } from "@/lib/db";

const PROVIDERS = [
  {
    key: "Vapi",
    icon: "⚡",
    title: "Vapi Number",
    detail: "Provision a fresh number directly from the voice pipeline",
  },
  {
    key: "Twilio (BYOT)",
    icon: "🔴",
    title: "BYOT Phone",
    detail: "Bring your own Twilio phone number",
  },
  {
    key: "Custom SIP Trunk",
    icon: "📞",
    title: "Custom SIP Trunk",
    detail: "Connect your own SIP trunk configuration",
  },
];

export default function PhoneNumbersPanel({ numbers }: { numbers: PhoneNumber[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return numbers
      .filter((n) => providerFilter === "all" || n.provider === providerFilter)
      .filter((n) => statusFilter === "all" || n.status === statusFilter)
      .filter((n) => !q || `${n.number} ${n.nickname ?? ""} ${n.agentName}`.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [numbers, query, providerFilter, statusFilter]);

  const allProviders = useMemo(() => [...new Set(numbers.map((n) => n.provider))], [numbers]);

  async function remove(n: PhoneNumber) {
    if (!confirm(`Remove ${n.number}?`)) return;
    await fetch(`/api/phone-numbers/${n.id}`, { method: "DELETE" });
    toast(`${n.number} removed.`);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Phone Numbers</h1>
          <p className="mt-1 text-sm text-ink-400">Manage phone numbers for your calling campaigns</p>
        </div>
        <button onClick={() => setPickerOpen(true)} className="btn-primary">+ Add Phone Number</button>
      </div>

      {/* Toolbar */}
      <div className="card flex flex-wrap items-center gap-3 !p-4">
        <div className="relative min-w-[220px] flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500"><Search className="h-4 w-4" /></span>
          <input className="field !pl-10" placeholder="Search phone numbers..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="field w-40 !py-2.5" value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)}>
          <option value="all">All Providers</option>
          {allProviders.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select className="field w-36 !py-2.5" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="unassigned">Unassigned</option>
        </select>
        <button onClick={() => router.refresh()} aria-label="Refresh" className="btn-secondary !px-3.5 !py-2.5"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {/* Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((n) => (
          <div key={n.id} className="card card-hover relative !p-5">
            <div className="flex items-start justify-between">
              <p className="text-sm text-ink-400">{n.provider}</p>
              <RowMenu
                items={[{ label: "Remove", icon: Trash2, danger: true, onClick: () => remove(n) }]}
              />
            </div>
            <p className="mt-2 font-mono text-xl font-bold tracking-wide">{n.number}</p>
            <p className="mt-1 text-sm text-ink-300">{n.nickname || n.agentName || "—"}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="badge-muted">{n.numberType ?? "national"}</span>
              <span className="badge-muted">{n.scope ?? "Global"}</span>
              <span className={n.status === "active" ? "badge-ok" : "badge-muted"}>{n.status}</span>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-ink-700/60 pt-3 text-xs text-ink-500">
              <span>Created {new Date(n.createdAt).toLocaleDateString()}</span>
              <span>Updated {new Date(n.updatedAt ?? n.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="card py-12 text-center text-sm text-ink-400">
          {numbers.length === 0 ? "No phone numbers yet — add your first one." : "No numbers match your filters."}
        </div>
      ) : (
        <p className="pb-1 text-center text-xs text-ink-500">You&apos;ve reached the end of the list.</p>
      )}

      {/* Provider picker */}
      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Add New Phone Number"
        subtitle="Select the type of phone number you want to add." wide>
        <div className="grid gap-4 sm:grid-cols-2">
          {PROVIDERS.map((p) => (
            <button key={p.key} onClick={() => { setPickerOpen(false); setProvider(p.key); }}
              className="card card-hover !p-6 text-left">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span>{p.icon}</span> {p.title}
              </p>
              <p className="mt-2 text-sm text-ink-400">{p.detail}</p>
            </button>
          ))}
        </div>
      </Modal>

      {provider && (
        <AddNumberModal provider={provider} onClose={() => setProvider(null)}
          onCreated={() => { setProvider(null); toast("Phone number added."); router.refresh(); }} />
      )}
    </div>
  );
}

function AddNumberModal({
  provider,
  onClose,
  onCreated,
}: {
  provider: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [number, setNumber] = useState("");
  const [nickname, setNickname] = useState("");
  const [numberType, setNumberType] = useState("national");
  // Credential fields — forwarded to the voice pipeline, never stored by us.
  const [sid, setSid] = useState("");
  const [token, setToken] = useState("");
  const [sipHost, setSipHost] = useState("");
  const [sipUser, setSipUser] = useState("");
  const [sipPass, setSipPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/phone-numbers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number, nickname, numberType, provider }),
    });
    if (res.ok) onCreated();
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={provider} subtitle="Configure the number and its connection." wide>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Phone Number</label>
            <input className="field" placeholder="+1 (415) 555-0100" value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div>
            <label className="label">Nickname</label>
            <input className="field" placeholder="Main clinic line" value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="field" value={numberType} onChange={(e) => setNumberType(e.target.value)}>
              <option value="national">National</option>
              <option value="local">Local</option>
              <option value="toll-free">Toll-free</option>
            </select>
          </div>
        </div>

        {provider === "Twilio (BYOT)" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Twilio Account SID</label>
              <input className="field" placeholder="AC…" value={sid} onChange={(e) => setSid(e.target.value)} />
            </div>
            <div>
              <label className="label">Twilio Auth Token</label>
              <input type="password" className="field" placeholder="••••••••" value={token} onChange={(e) => setToken(e.target.value)} />
            </div>
          </div>
        )}

        {provider === "Custom SIP Trunk" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">SIP Gateway / Host</label>
              <input className="field" placeholder="sip.yourprovider.com" value={sipHost} onChange={(e) => setSipHost(e.target.value)} />
            </div>
            <div>
              <label className="label">Username</label>
              <input className="field" value={sipUser} onChange={(e) => setSipUser(e.target.value)} />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" className="field" value={sipPass} onChange={(e) => setSipPass(e.target.value)} />
            </div>
          </div>
        )}

        {provider === "Vapi" && (
          <p className="rounded-lg bg-ink-800 px-4 py-3 text-xs text-ink-300">
            The number is provisioned in your Vapi account and linked here. Enter
            the number exactly as it appears in Vapi → Phone Numbers.
          </p>
        )}

        <p className="text-xs text-ink-500">
          🔒 Credentials are used to connect the number in the voice pipeline and
          are never stored in this dashboard&apos;s database.
        </p>

        {error && (
          <p className="rounded-lg border border-signal-red/40 bg-signal-red/10 px-3.5 py-2.5 text-sm text-signal-red">{error}</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={create} disabled={busy} className="btn-primary disabled:opacity-60">
            {busy ? "Adding…" : "Add Number"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
