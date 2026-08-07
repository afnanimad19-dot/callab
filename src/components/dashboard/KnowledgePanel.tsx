"use client";
import { Search, RefreshCw, MoreVertical } from "lucide-react";

// Knowledge Base: searchable grid of resources, "+ Add Resource" dropdown
// (Text Content / URL / Upload File / Google Doc) opening the type-specific
// modal, a "Test" slide-over chat that queries the stored content, and a
// per-card actions menu.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import type { KnowledgeBase } from "@/lib/db";

const TYPE_META: Record<string, { icon: string; badge: string }> = {
  url: { icon: "🔗", badge: "URL" },
  file: { icon: "📄", badge: "File" },
  text: { icon: "📝", badge: "Text" },
  gdoc: { icon: "📃", badge: "Google Doc" },
};

type ResourceType = "text" | "url" | "file" | "gdoc";

export default function KnowledgePanel({ items }: { items: KnowledgeBase[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [addMenu, setAddMenu] = useState(false);
  const [addType, setAddType] = useState<ResourceType | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((k) => !q || `${k.name} ${k.description} ${k.content ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [items, query]);

  async function remove(kb: KnowledgeBase) {
    setMenuFor(null);
    if (!confirm(`Delete "${kb.name}"?`)) return;
    await fetch(`/api/knowledge/${kb.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-5" onClick={() => { setMenuFor(null); setAddMenu(false); }}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="mt-1 text-sm text-ink-400">Manage knowledge resources for your AI agents</p>
        </div>
        <div className="relative flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setTestOpen(true)} className="btn-secondary">🧪 Test</button>
          <button onClick={() => setAddMenu((v) => !v)} className="btn-primary">+ Add Resource</button>
          {addMenu && (
            <div className="absolute right-0 top-12 z-30 w-48 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 py-1 shadow-xl shadow-black/30">
              {([
                ["text", "📝 Text Content"],
                ["url", "🔗 URL / Website"],
                ["file", "📄 Upload File"],
                ["gdoc", "📃 Google Doc"],
              ] as [ResourceType, string][]).map(([t, label]) => (
                <button key={t}
                  onClick={() => { setAddMenu(false); setAddType(t); }}
                  className="block w-full px-4 py-2.5 text-left text-sm text-ink-200 transition hover:bg-ink-800">
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="card flex items-center gap-3 !p-4">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500"><Search className="h-4 w-4" /></span>
          <input className="field !pl-10" placeholder="Search by name or content..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button onClick={() => router.refresh()} aria-label="Refresh" className="btn-secondary !px-3.5 !py-2.5"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {/* Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((kb) => {
          const meta = TYPE_META[kb.type ?? "file"];
          return (
            <div key={kb.id} className="card card-hover relative flex flex-col !p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-800 text-lg">{meta.icon}</span>
                  <div>
                    <h2 className="text-sm font-semibold leading-snug">{kb.name}</h2>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="badge-warn">{meta.badge}</span>
                      {kb.autoUpdate && <span className="badge-ok">⟳ Auto 24h</span>}
                    </div>
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === kb.id ? null : kb.id); }}
                  aria-label="Actions"
                  className="rounded-lg px-2 py-0.5 text-lg leading-none text-ink-400 transition hover:bg-ink-800 hover:text-ink-100">
                  <MoreVertical className="h-4 w-4" />
                </button>
                {menuFor === kb.id && (
                  <div className="absolute right-4 top-12 z-20 w-36 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 py-1 shadow-xl shadow-black/30"
                    onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => remove(kb)} className="block w-full px-4 py-2 text-left text-sm text-signal-red transition hover:bg-ink-800">
                      🗑 Delete
                    </button>
                  </div>
                )}
              </div>
              <p className="mt-3 flex-1 text-sm text-ink-400">{kb.description}</p>
              <p className="mt-4 border-t border-ink-700/60 pt-3 text-xs text-ink-500">
                🗓 {new Date(kb.updatedAt ?? kb.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · Updated
              </p>
            </div>
          );
        })}
      </div>
      {visible.length === 0 && (
        <div className="card py-12 text-center text-sm text-ink-400">
          {items.length === 0 ? "No resources yet — add your first one." : "No resources match your search."}
        </div>
      )}

      {addType && (
        <AddResourceModal type={addType} onClose={() => setAddType(null)} onCreated={() => { setAddType(null); router.refresh(); }} />
      )}
      {testOpen && <TestPanel items={items} onClose={() => setTestOpen(false)} />}
    </div>
  );
}

function AddResourceModal({
  type,
  onClose,
  onCreated,
}: {
  type: ResourceType;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [multipleUrls, setMultipleUrls] = useState(false);
  const [crawl, setCrawl] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, url, content, multipleUrls, crawl, autoUpdate }),
    });
    if (res.ok) onCreated();
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add Resource" wide>
      <div className="space-y-4">
        <div>
          <label className="label">Name</label>
          <input className="field" placeholder="Enter resource name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Type</label>
          <div className="field flex items-center gap-2 !py-2.5 text-ink-300">
            {TYPE_META[type].icon} {TYPE_META[type].badge}
          </div>
        </div>

        {type === "url" && (
          <>
            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-accent-500" checked={multipleUrls} onChange={(e) => setMultipleUrls(e.target.checked)} />
              Multiple URLs
            </label>
            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-accent-500" checked={crawl} onChange={(e) => setCrawl(e.target.checked)} />
              Crawl entire website
            </label>
            <div className="rounded-xl border border-ink-700 p-4">
              <label className="flex items-center gap-2.5 text-sm font-medium">
                <input type="checkbox" className="h-4 w-4 accent-accent-500" checked={autoUpdate} onChange={(e) => setAutoUpdate(e.target.checked)} />
                Enable automatic updates
              </label>
              <p className="mt-1.5 text-xs text-ink-400">
                When enabled, this knowledge base will automatically refresh its content every 24 hours.
              </p>
            </div>
            <div>
              <label className="label">URL{multipleUrls ? "s (one per line)" : ""}</label>
              {multipleUrls ? (
                <textarea rows={3} className="field" placeholder={"https://example.com\nhttps://example.com/pricing"} value={url} onChange={(e) => setUrl(e.target.value)} />
              ) : (
                <input className="field" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
              )}
            </div>
          </>
        )}

        {type === "gdoc" && (
          <div>
            <label className="label">Google Doc link</label>
            <input className="field" placeholder="https://docs.google.com/document/d/…" value={url} onChange={(e) => setUrl(e.target.value)} />
            <p className="mt-1 text-xs text-ink-400">The document must be shared as “Anyone with the link can view”.</p>
          </div>
        )}

        {type === "text" && (
          <div>
            <label className="label">Text content</label>
            <textarea rows={7} className="field" placeholder="Paste the content your agents should answer from…" value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
        )}

        {type === "file" && (
          <div>
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.txt,.md,.docx,.csv"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")} />
            <button onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ink-600 py-9 text-sm text-ink-400 transition hover:border-accent-500/50 hover:text-ink-200">
              <span className="text-2xl">📄</span>
              {fileName || "Click to choose a file (PDF, TXT, MD, DOCX, CSV)"}
            </button>
            <p className="mt-1.5 text-xs text-ink-500">
              File contents are indexed for agent answers when knowledge sync to the voice pipeline is connected.
            </p>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-signal-red/40 bg-signal-red/10 px-3.5 py-2.5 text-sm text-signal-red">{error}</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={create} disabled={busy} className="btn-primary disabled:opacity-60">
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TestPanel({ items, onClose }: { items: KnowledgeBase[]; onClose: () => void }) {
  const [searchAll, setSearchAll] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [chat, setChat] = useState<{ from: "you" | "kb"; text: string; sources?: string[] }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask() {
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setChat((c) => [...c, { from: "you", text: question }]);
    setBusy(true);
    const res = await fetch("/api/knowledge/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, kbIds: selected, searchAll }),
    });
    const data = await res.json().catch(() => ({ answer: "Something went wrong." }));
    setChat((c) => [...c, { from: "kb", text: data.answer, sources: data.sources }]);
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-full w-full max-w-md flex-col border-l border-ink-700 bg-ink-900">
        <div className="border-b border-ink-700 px-5 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Test Knowledge Base</h2>
            <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100">✕</button>
          </div>
          <p className="mt-0.5 text-xs text-ink-400">Query your knowledge base(s) to test RAG responses</p>
          <label className="mt-3 flex items-center gap-2.5 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-accent-500" checked={searchAll} onChange={(e) => setSearchAll(e.target.checked)} />
            Search all knowledge bases
          </label>
          {!searchAll && (
            <select className="field mt-2 !py-2" value=""
              onChange={(e) => e.target.value && !selected.includes(e.target.value) && setSelected([...selected, e.target.value])}>
              <option value="">Add knowledge base…</option>
              {items.filter((k) => !selected.includes(k.id)).map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
          )}
          {!searchAll && selected.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selected.map((id) => {
                const kb = items.find((k) => k.id === id);
                return (
                  <button key={id} onClick={() => setSelected(selected.filter((s) => s !== id))} className="badge-ok">
                    {kb?.name ?? id} ✕
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {chat.length === 0 ? (
            <div className="pt-20 text-center text-sm text-ink-500">
              <p className="text-3xl">🤖</p>
              <p className="mt-3">Start a conversation to test your knowledge base</p>
              <p className="mt-1 text-xs">Ask questions and see how the retrieval responds</p>
            </div>
          ) : (
            chat.map((m, i) => (
              <div key={i} className={`flex ${m.from === "you" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[90%] rounded-2xl px-3.5 py-2 text-sm ${m.from === "you" ? "grad-bg text-white" : "bg-ink-800 text-ink-200"}`}>
                  {m.text}
                  {m.sources && m.sources.length > 0 && (
                    <p className="mt-1.5 text-xs opacity-75">Sources: {m.sources.join(", ")}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-ink-700 p-3">
          {!searchAll && selected.length === 0 && (
            <p className="mb-2 text-xs text-signal-amber">ⓘ Select knowledge base(s) or enable “Search all”</p>
          )}
          <div className="flex gap-2">
            <button onClick={() => setChat([])} aria-label="Clear chat" className="btn-secondary !px-3">🗑</button>
            <input className="field !py-2" placeholder="Ask a question…" value={input}
              onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} />
            <button onClick={ask} disabled={busy} className="btn-primary !px-4 !py-2 disabled:opacity-60">➤</button>
          </div>
        </div>
      </div>
    </div>
  );
}
