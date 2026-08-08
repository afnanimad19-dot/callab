"use client";
import { Search, RefreshCw, Pencil, Trash2, Upload, Download } from "lucide-react";
import RowMenu from "./RowMenu";
import { toast } from "@/components/Toast";

// Contacts: Import / Export / Add Contact toolbar, searchable paginated
// table with select checkboxes, source/category/tag badges, per-row menu,
// Add New Contact modal (with metadata fields), CSV import, CSV export
// with a success toast.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import type { Contact } from "@/lib/db";

const PAGE_SIZES = [10, 25, 50, 100];

const COUNTRY_CODES = [
  ["+1", "United States"],
  ["+44", "United Kingdom"],
  ["+971", "United Arab Emirates"],
  ["+966", "Saudi Arabia"],
  ["+92", "Pakistan"],
  ["+91", "India"],
  ["+49", "Germany"],
  ["+33", "France"],
];

function downloadCsv(rows: Contact[]) {
  const header = "name,phone,category,tag,source,created";
  const lines = rows.map((c) =>
    [c.name, c.phone, c.category ?? "", c.tag, c.source ?? "", c.createdAt]
      .map((v) => `"${String(v).replaceAll('"', '""')}"`)
      .join(",")
  );
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "contacts.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function ContactsPanel({ contacts }: { contacts: Contact[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts
      .filter((c) => !q || `${c.name} ${c.phone} ${c.tag} ${c.category ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [contacts, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * perPage, current * perPage);

  async function remove(c: Contact) {
    if (!confirm(`Delete contact "${c.name}"?`)) return;
    await fetch(`/api/contacts/${c.id}`, { method: "DELETE" });
    toast(`Contact "${c.name}" deleted.`);
    router.refresh();
  }

  function toggleAll() {
    setChecked((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="mt-1 text-sm text-ink-400">Manage contacts within your company</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setImportOpen(true)} className="btn-secondary flex items-center gap-1.5"><Upload className="h-4 w-4" /> Import</button>
          <button
            onClick={() => { downloadCsv(filtered); toast("Contacts exported successfully."); }}
            className="btn-secondary flex items-center gap-1.5"
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <button onClick={() => setAddOpen(true)} className="btn-primary">+ Add Contact</button>
        </div>
      </div>

      {/* Search */}
      <div className="card flex items-center gap-3 !p-4">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500"><Search className="h-4 w-4" /></span>
          <input className="field !pl-10" placeholder="Search contacts..." value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
        </div>
        <button onClick={() => router.refresh()} aria-label="Refresh" className="btn-secondary !px-3.5 !py-2.5"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto !p-0">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="w-10 px-4 py-3">
                <input type="checkbox" className="h-4 w-4 accent-accent-500"
                  checked={rows.length > 0 && checked.size === rows.length} onChange={toggleAll} />
              </th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Tag</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700/70">
            {rows.map((c) => (
              <tr key={c.id} className="transition hover:bg-ink-800/60">
                <td className="px-4 py-3">
                  <input type="checkbox" className="h-4 w-4 accent-accent-500"
                    checked={checked.has(c.id)}
                    onChange={() =>
                      setChecked((prev) => {
                        const next = new Set(prev);
                        if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                        return next;
                      })
                    } />
                </td>
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 font-mono text-[13px] text-ink-300">{c.phone}</td>
                <td className="px-4 py-3">
                  <span className={c.source === "Manual" ? "badge-ok" : "badge-warn"}>
                    {c.source ?? "Manual"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="badge-muted">{c.category || "—"}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-950">
                    {c.tag}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-400">
                  {new Date(c.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-3 text-right">
                  <RowMenu
                    items={[
                      { label: "Edit", icon: Pencil, onClick: () => setEditing(c) },
                      { label: "Delete", icon: Trash2, danger: true, onClick: () => remove(c) },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-ink-400">
            {contacts.length === 0 ? "No contacts yet." : "No contacts match your search."}
          </p>
        )}
        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-700 px-5 py-3 text-sm text-ink-400">
          <span className="flex items-center gap-3">
            <span>
              Showing {filtered.length === 0 ? 0 : (current - 1) * perPage + 1} to{" "}
              {Math.min(current * perPage, filtered.length)} of {filtered.length} contacts
            </span>
            <label className="flex items-center gap-1.5 text-xs">
              Rows per page
              <select
                className="field !w-auto !px-2 !py-1 !text-xs"
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setPage(1);
                }}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </span>
          <div className="flex items-center gap-1.5">
            <button disabled={current === 1} onClick={() => setPage(current - 1)}
              className="btn-secondary !px-3 !py-1.5 !text-xs disabled:opacity-40">‹ Previous</button>
            {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${p === current ? "grad-bg text-white" : "text-ink-300 hover:bg-ink-800"}`}>
                {p}
              </button>
            ))}
            {pages > 5 && <span>… {pages}</span>}
            <button disabled={current === pages} onClick={() => setPage(current + 1)}
              className="btn-secondary !px-3 !py-1.5 !text-xs disabled:opacity-40">Next ›</button>
          </div>
        </div>
      </div>

      {addOpen && (
        <AddContactModal onClose={() => setAddOpen(false)}
          onCreated={() => { setAddOpen(false); router.refresh(); toast("Contact saved."); }} />
      )}
      {editing && (
        <AddContactModal existing={editing} onClose={() => setEditing(null)}
          onCreated={() => { setEditing(null); router.refresh(); toast("Contact updated."); }} />
      )}
      {importOpen && (
        <ImportModal onClose={() => setImportOpen(false)}
          onImported={(n) => { setImportOpen(false); router.refresh(); toast(`${n} contacts imported successfully.`); }} />
      )}

    </div>
  );
}

function AddContactModal({
  existing,
  onClose,
  onCreated,
}: {
  existing?: Contact;
  onClose: () => void;
  onCreated: () => void;
}) {
  const nameParts = (existing?.name ?? "").split(" ");
  const [firstName, setFirstName] = useState(nameParts[0] ?? "");
  const [lastName, setLastName] = useState(nameParts.slice(1).join(" "));
  const [code, setCode] = useState("+1");
  const [customFormat, setCustomFormat] = useState(Boolean(existing));
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [category, setCategory] = useState(existing?.category ?? "Lead");
  const [tag, setTag] = useState(existing?.tag ?? "");
  const [meta, setMeta] = useState<{ key: string; value: string }[]>(
    existing?.metadata ? Object.entries(existing.metadata).map(([key, value]) => ({ key, value })) : []
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    const metadata: Record<string, string> = {};
    for (const m of meta) if (m.key.trim()) metadata[m.key] = m.value;
    const res = existing
      ? await fetch(`/api/contacts/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${firstName} ${lastName}`.trim(),
            phone: customFormat ? phone : `${code} ${phone}`.trim(),
            category,
            tag: tag || "lead",
            metadata,
          }),
        })
      : await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName,
            lastName,
            phone: customFormat ? phone : `${code} ${phone}`.trim(),
            category,
            tag: tag || "lead",
            metadata,
          }),
        });
    if (res.ok) onCreated();
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={existing ? "Edit Contact" : "Add New Contact"}
      subtitle={existing ? "Update this contact's details." : "Create a new contact to use in your calling campaigns."} wide>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">First Name *</label>
            <input className="field" placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <label className="label">Last Name *</label>
            <input className="field" placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Phone Number *</label>
          <div className="grid gap-3 sm:grid-cols-2">
            {!customFormat && (
              <select className="field" value={code} onChange={(e) => setCode(e.target.value)}>
                {COUNTRY_CODES.map(([c, name]) => (
                  <option key={c} value={c}>{name} ({c})</option>
                ))}
              </select>
            )}
            <input className={`field ${customFormat ? "sm:col-span-2" : ""}`}
              placeholder={customFormat ? "Any format" : "(e.g. 5551234567)"}
              value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <label className="mt-2 flex items-center justify-end gap-2 text-xs text-ink-300">
            <input type="checkbox" className="h-3.5 w-3.5 accent-accent-500"
              checked={customFormat} onChange={(e) => setCustomFormat(e.target.checked)} />
            Use Custom Format
          </label>
        </div>
        <div>
          <label className="label">Category *</label>
          <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
            {["Lead", "Customer", "Quote request", "VIP", "Other"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tag *</label>
          <input className="field" placeholder="E.g., Lead, VIP, Demo Request" value={tag} onChange={(e) => setTag(e.target.value)} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label !mb-0">Metadata (Optional)</label>
            <button onClick={() => setMeta([...meta, { key: "", value: "" }])} className="btn-secondary !px-3 !py-1.5 !text-xs">
              + Add Field
            </button>
          </div>
          {meta.map((m, i) => (
            <div key={i} className="mt-2 flex gap-2">
              <input className="field w-40" placeholder="Field" value={m.key}
                onChange={(e) => setMeta(meta.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
              <input className="field flex-1" placeholder="Value" value={m.value}
                onChange={(e) => setMeta(meta.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
              <button onClick={() => setMeta(meta.filter((_, j) => j !== i))} aria-label="Remove field" className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-signal-red"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        {error && (
          <p className="rounded-lg border border-signal-red/40 bg-signal-red/10 px-3.5 py-2.5 text-sm text-signal-red">{error}</p>
        )}
        <div className="flex justify-end">
          <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">
            {busy ? "Saving…" : existing ? "Save Changes" : "Save Contact"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: (n: number) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<{ name: string; phone: string; tag?: string }[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function parseCsv(text: string) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const header = lines[0].toLowerCase().split(",").map((h) => h.replaceAll('"', "").trim());
    const nameIdx = header.findIndex((h) => h.includes("name"));
    const phoneIdx = header.findIndex((h) => h.includes("phone") || h.includes("number"));
    const tagIdx = header.findIndex((h) => h.includes("tag"));
    if (nameIdx < 0 || phoneIdx < 0) return [];
    return lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.replaceAll('"', "").trim());
      return { name: cols[nameIdx] ?? "", phone: cols[phoneIdx] ?? "", tag: tagIdx >= 0 ? cols[tagIdx] : undefined };
    }).filter((r) => r.name && r.phone);
  }

  async function onFile(f: File) {
    setFileName(f.name);
    setError(null);
    const parsed = parseCsv(await f.text());
    if (parsed.length === 0) setError("Couldn't find rows — the CSV needs 'name' and 'phone' columns.");
    setRows(parsed);
  }

  async function doImport() {
    setBusy(true);
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacts: rows }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) onImported(data.imported ?? rows.length);
    else {
      setError(data.error ?? "Import failed.");
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Import Contacts"
      subtitle="Upload a CSV file with 'name' and 'phone' columns (a 'tag' column is optional)." wide>
      <div className="space-y-4">
        <input ref={fileRef} type="file" accept=".csv" className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <button onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ink-600 py-9 text-sm text-ink-400 transition hover:border-accent-500/50 hover:text-ink-200">
          <Upload className="h-6 w-6" />
          {fileName || "Click to choose a CSV file"}
        </button>
        {rows.length > 0 && (
          <div className="card !p-0">
            <p className="border-b border-ink-700 px-4 py-2.5 text-xs font-semibold text-ink-300">
              Preview — {rows.length} contact{rows.length === 1 ? "" : "s"} ready to import
            </p>
            <div className="max-h-40 overflow-y-auto">
              {rows.slice(0, 6).map((r, i) => (
                <div key={i} className="flex justify-between border-b border-ink-700/50 px-4 py-2 text-sm last:border-0">
                  <span>{r.name}</span>
                  <span className="font-mono text-xs text-ink-400">{r.phone}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {error && (
          <p className="rounded-lg border border-signal-red/40 bg-signal-red/10 px-3.5 py-2.5 text-sm text-signal-red">{error}</p>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={doImport} disabled={busy || rows.length === 0} className="btn-primary disabled:opacity-60">
            {busy ? "Importing…" : `Import ${rows.length || ""} contacts`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
