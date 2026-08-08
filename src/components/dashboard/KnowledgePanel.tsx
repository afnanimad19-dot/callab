"use client";
import {
  Search,
  RefreshCw,
  FlaskConical,
  Pencil,
  Copy,
  Trash2,
  Link2,
  FileText,
  AlignLeft,
  FileType,
  Download,
  Calendar,
  Upload,
  X,
  Send,
  type LucideIcon,
} from "lucide-react";
import RowMenu from "./RowMenu";
import { toast } from "@/components/Toast";

// Knowledge Base: searchable grid of resources, "+ Add Resource" dropdown
// (Text Content / URL / Upload File / Google Doc) opening the type-specific
// modal, a "Test" slide-over chat that queries the stored content, and a
// per-card actions menu.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import type { KnowledgeBase } from "@/lib/db";

const TYPE_META: Record<string, { icon: LucideIcon; badge: string }> = {
  url: { icon: Link2, badge: "URL" },
  file: { icon: FileText, badge: "File" },
  text: { icon: AlignLeft, badge: "Text" },
  gdoc: { icon: FileType, badge: "Google Doc" },
};

type ResourceType = "text" | "url" | "file" | "gdoc";

export default function KnowledgePanel({ items }: { items: KnowledgeBase[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [addMenu, setAddMenu] = useState(false);
  const [addType, setAddType] = useState<ResourceType | null>(null);
  const [editing, setEditing] = useState<KnowledgeBase | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [testPreselect, setTestPreselect] = useState<string[]>([]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((k) => !q || `${k.name} ${k.description} ${k.content ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [items, query]);

  async function remove(kb: KnowledgeBase) {
    if (!confirm(`Delete "${kb.name}"?`)) return;
    await fetch(`/api/knowledge/${kb.id}`, { method: "DELETE" });
    toast(`"${kb.name}" deleted.`);
    router.refresh();
  }

  function download(kb: KnowledgeBase) {
    const blob = new Blob([kb.content || `${kb.name}\n${kb.url ?? ""}`], {
      type: "text/plain;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = kb.fileName || `${kb.name.replace(/[^\w.-]+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`"${kb.name}" downloaded.`);
  }

  async function duplicate(kb: KnowledgeBase) {
    await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${kb.name} (Copy)`,
        type: kb.type ?? "text",
        url: kb.url ?? "",
        content: kb.content ?? "",
        autoUpdate: kb.autoUpdate ?? false,
        crawl: kb.crawl ?? false,
        multipleUrls: kb.multipleUrls ?? false,
      }),
    });
    toast(`"${kb.name}" copied.`);
    router.refresh();
  }

  return (
    <div className="space-y-5" onClick={() => setAddMenu(false)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="mt-1 text-sm text-ink-400">Manage knowledge resources for your AI agents</p>
        </div>
        <div className="relative flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setTestOpen(true)} className="btn-secondary flex items-center gap-1.5">
            <FlaskConical className="h-4 w-4" /> Test
          </button>
          <button onClick={() => setAddMenu((v) => !v)} className="btn-primary">+ Add Resource</button>
          {addMenu && (
            <div className="absolute right-0 top-12 z-30 w-52 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 py-1 shadow-xl shadow-black/30">
              {([
                ["text", "Text Content", AlignLeft],
                ["url", "URL / Website", Link2],
                ["file", "Upload File", Upload],
                ["gdoc", "Google Doc", FileType],
              ] as [ResourceType, string, LucideIcon][]).map(([t, label, Icon]) => (
                <button key={t}
                  onClick={() => { setAddMenu(false); setAddType(t); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink-200 transition hover:bg-ink-800">
                  <Icon className="h-4 w-4 text-ink-400" /> {label}
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
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-800">
                    <meta.icon className="h-5 w-5 text-ink-300" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold leading-snug">{kb.name}</h2>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="badge-warn">{meta.badge}</span>
                      {kb.autoUpdate && (
                        <span className="badge-ok inline-flex items-center gap-1">
                          <RefreshCw className="h-3 w-3" /> Auto 24h
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <RowMenu
                  items={[
                    {
                      label: "Test",
                      icon: FlaskConical,
                      onClick: () => {
                        setTestPreselect([kb.id]);
                        setTestOpen(true);
                      },
                    },
                    { label: "Edit", icon: Pencil, onClick: () => setEditing(kb) },
                    ...(kb.content || kb.type === "file"
                      ? [{ label: "Download", icon: Download, onClick: () => download(kb) }]
                      : []),
                    { label: "Copy", icon: Copy, onClick: () => duplicate(kb) },
                    { label: "Delete", icon: Trash2, danger: true, onClick: () => remove(kb) },
                  ]}
                />
              </div>
              <p className="mt-3 flex-1 text-sm text-ink-400">{kb.description}</p>
              <p className="mt-4 flex items-center gap-1.5 border-t border-ink-700/60 pt-3 text-xs text-ink-500">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(kb.updatedAt ?? kb.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · Updated
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
        <AddResourceModal type={addType} onClose={() => setAddType(null)} onCreated={() => { setAddType(null); toast("Resource created."); router.refresh(); }} />
      )}
      {editing && (
        <AddResourceModal
          type={(editing.type ?? "text") as ResourceType}
          existing={editing}
          onClose={() => setEditing(null)}
          onCreated={() => { setEditing(null); toast("Resource updated."); router.refresh(); }}
        />
      )}
      {testOpen && (
        <TestPanel
          items={items}
          initialSelected={testPreselect}
          onClose={() => { setTestOpen(false); setTestPreselect([]); }}
        />
      )}
    </div>
  );
}

function AddResourceModal({
  type,
  existing,
  onClose,
  onCreated,
}: {
  type: ResourceType;
  existing?: KnowledgeBase;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [url, setUrl] = useState(existing?.url ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [multipleUrls, setMultipleUrls] = useState(existing?.multipleUrls ?? false);
  const [crawl, setCrawl] = useState(existing?.crawl ?? false);
  const [autoUpdate, setAutoUpdate] = useState(existing?.autoUpdate ?? false);
  const [fileName, setFileName] = useState(existing?.fileName ?? "");
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Read the uploaded file's text so agents can actually answer from it.
  async function onFilePicked(f: File) {
    setFileName(f.name);
    if (!name.trim()) setName(f.name.replace(/\.[^.]+$/, ""));
    const textLike = /\.(txt|md|csv|json|html?)$/i.test(f.name);
    if (textLike) {
      const text = await f.text();
      setContent(text.slice(0, 20000));
      setFileNote(`${f.name} — ${Math.min(text.length, 20000).toLocaleString()} characters read and indexed.`);
    } else {
      setContent("");
      setFileNote(
        `${f.name} attached. PDF/DOCX text can't be extracted in the browser — paste the key content as a Text resource for the agent to answer from it.`
      );
    }
  }

  async function create() {
    setBusy(true);
    setError(null);
    const res = existing
      ? await fetch(`/api/knowledge/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, url, content, multipleUrls, crawl, autoUpdate, fileName }),
        })
      : await fetch("/api/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, type, url, content, multipleUrls, crawl, autoUpdate, fileName }),
        });
    if (res.ok) onCreated();
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={existing ? "Edit Resource" : "Add Resource"} wide>
      <div className="space-y-4">
        <div>
          <label className="label">Name</label>
          <input className="field" placeholder="Enter resource name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Type</label>
          <div className="field flex items-center gap-2 !py-2.5 text-ink-300">
            {(() => {
              const Icon = TYPE_META[type].icon;
              return <Icon className="h-4 w-4 text-ink-400" />;
            })()}
            {TYPE_META[type].badge}
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
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.txt,.md,.docx,.csv,.json,.html"
              onChange={(e) => e.target.files?.[0] && onFilePicked(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ink-600 py-9 text-sm text-ink-400 transition hover:border-accent-500/50 hover:text-ink-200">
              <Upload className="h-6 w-6" />
              {fileName || "Click to choose a file (TXT, MD, CSV, JSON, HTML, PDF, DOCX)"}
            </button>
            {fileNote && (
              <p className="mt-1.5 rounded-lg bg-ink-800/60 px-3 py-2 text-xs text-ink-300">{fileNote}</p>
            )}
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-signal-red/40 bg-signal-red/10 px-3.5 py-2.5 text-sm text-signal-red">{error}</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={create} disabled={busy} className="btn-primary disabled:opacity-60">
            {busy ? "Saving…" : existing ? "Save changes" : "Create"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TestPanel({
  items,
  initialSelected = [],
  onClose,
}: {
  items: KnowledgeBase[];
  initialSelected?: string[];
  onClose: () => void;
}) {
  const [searchAll, setSearchAll] = useState(false);
  const [selected, setSelected] = useState<string[]>(initialSelected);
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
            <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100"><X className="h-4 w-4" /></button>
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
                    {kb?.name ?? id} <X className="h-3 w-3" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {chat.length === 0 ? (
            <div className="pt-20 text-center text-sm text-ink-500">
              <FlaskConical className="mx-auto h-7 w-7 text-ink-400" />
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
            <button onClick={() => setChat([])} aria-label="Clear chat" className="btn-secondary !px-3"><Trash2 className="h-4 w-4" /></button>
            <input className="field !py-2" placeholder="Ask a question…" value={input}
              onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} />
            <button onClick={ask} disabled={busy} className="btn-primary !px-4 !py-2 disabled:opacity-60"><Send className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
