"use client";

// Visual Flow Designer (Callab parity): full-screen dotted canvas with a
// shrunken icon rail, draggable nodes (Start Call / Prompt / Webhook /
// Transfer / End Call), dashed bezier edges with clickable condition pills,
// node & edge slide-over editors, Variables + Global Tools + Share + Embed +
// Test side menu, See Errors / See Warnings validation, zoom / fit /
// fullscreen / auto-layout controls, a minimap, AI flow generation, and
// real test calls (web + phone). Saving compiles the flow into the agent's
// prompt/tools server-side so it runs on real calls.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Phone, PhoneOff, PhoneForwarded, MessageCircle, SquareFunction,
  Plus, X, Braces, Wrench, Share2, Code2, MessageSquare, Save, Sparkles,
  ChevronDown, FlaskConical, ZoomIn, ZoomOut, Crosshair, Maximize, LayoutGrid,
  Copy, Trash2, Settings, Bot, BookOpen, Rocket, Users, PhoneCall, Radio,
  Link2, Webhook as WebhookIcon, CircleAlert, Pencil, CircleCheck,
  GitBranch, Info,
} from "lucide-react";
import type { Agent, KnowledgeBase, PhoneNumber } from "@/lib/db";
import type { AgentTool } from "@/lib/agent-defaults";
import {
  ConversationFlow, FlowNode, FlowEdge, FlowNodeType,
  defaultFlow, validateFlow, newFlowId, PREDEFINED_FLOW_VARS, detectCustomVars,
} from "@/lib/flow";
import { toast, toastError } from "@/components/Toast";
import { PhoneTestCallModal, WebCallModal } from "@/components/dashboard/TestCallModals";
import TestAgentPanel from "@/components/dashboard/TestAgentPanel";

const NODE_W = 232;
const NODE_H = 118;

const NODE_STYLE: Record<FlowNodeType, {
  card: string; title: string; icon: React.ComponentType<{ className?: string }>; plus: string;
}> = {
  start: { card: "border-emerald-200 bg-emerald-50/90", title: "text-emerald-600", icon: Phone, plus: "border-emerald-300 text-emerald-500" },
  prompt: { card: "border-blue-200 bg-blue-50/70", title: "text-blue-600", icon: MessageCircle, plus: "border-blue-300 text-blue-500" },
  webhook: { card: "border-amber-300 bg-amber-50/90", title: "text-amber-600", icon: SquareFunction, plus: "border-amber-300 text-amber-500" },
  transfer: { card: "border-violet-200 bg-violet-50/80", title: "text-violet-600", icon: PhoneForwarded, plus: "border-violet-300 text-violet-500" },
  end: { card: "border-rose-200 bg-rose-50/80", title: "text-rose-600", icon: PhoneOff, plus: "border-rose-300 text-rose-500" },
};

const ADD_NODE_OPTIONS: { type: FlowNodeType; title: string; blurb: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "prompt", title: "Prompt", blurb: "Instruct the agent", icon: MessageCircle },
  { type: "webhook", title: "Webhook", blurb: "Call live webhook", icon: SquareFunction },
  { type: "transfer", title: "Transfer call", blurb: "Transfer call to a human", icon: PhoneForwarded },
  { type: "end", title: "End Call", blurb: "End the call", icon: PhoneOff },
];

const GLOBAL_TOOL_OPTIONS: { type: string; title: string; blurb: string }[] = [
  { type: "end_call", title: "End Call", blurb: "Allows the AI agent to end the current call" },
  { type: "transfer_call", title: "Transfer Call", blurb: "Transfer the caller to a phone number" },
  { type: "live_webhook", title: "Live Webhook", blurb: "Send data to an external API during the call" },
  { type: "send_email", title: "Send Email", blurb: "Send an email to the caller" },
  { type: "customer_memory", title: "Customer Memory", blurb: "Recognise returning customers from Contacts" },
];

function nodeDefaults(type: FlowNodeType): { label: string; data: FlowNode["data"] } {
  switch (type) {
    case "start": return { label: "Start Call", data: { openingMessage: "", goal: "" } };
    case "prompt": return { label: "New Prompt", data: { goal: "", kbIds: [], includeGlobalTools: true, tools: [], extract: [] } };
    case "webhook": return { label: "New Func", data: { method: "POST", url: "", headers: "", body: "" } };
    case "transfer": return { label: "New Transfer", data: { transferType: "sip", destination: "", message: "" } };
    case "end": return { label: "New End", data: { closingMessage: "" } };
  }
}

export default function FlowDesigner({
  agent,
  knowledgeBases,
  phoneNumbers,
}: {
  agent: Agent;
  knowledgeBases: KnowledgeBase[];
  phoneNumbers: PhoneNumber[];
}) {
  const router = useRouter();
  const [flow, setFlow] = useState<ConversationFlow>(agent.flow ?? defaultFlow());
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  // Viewport
  const [pan, setPan] = useState({ x: 120, y: 40 });
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Selection / panels
  const [panel, setPanel] = useState<
    | { kind: "node"; id: string }
    | { kind: "edge"; id: string }
    | { kind: "variables" }
    | { kind: "globalTools" }
    | { kind: "share" }
    | { kind: "embed" }
    | null
  >(null);
  const [addMenu, setAddMenu] = useState<{ nodeId: string } | null>(null);
  const [issuesOpen, setIssuesOpen] = useState<"error" | "warning" | null>(null);
  const [callMenu, setCallMenu] = useState(false);
  const [genMenu, setGenMenu] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [webCall, setWebCall] = useState(false);
  const [phoneCall, setPhoneCall] = useState(false);
  const [testPanel, setTestPanel] = useState(false);

  const issues = useMemo(() => validateFlow(flow), [flow]);
  const errors = issues.filter((i) => i.kind === "error");
  const warnings = issues.filter((i) => i.kind === "warning");

  const mutate = useCallback((fn: (f: ConversationFlow) => ConversationFlow) => {
    setFlow((f) => fn(f));
    setDirty(true);
  }, []);

  // --- Canvas interactions ---------------------------------------------------

  const dragRef = useRef<
    | { kind: "node"; id: string; startX: number; startY: number; nodeX: number; nodeY: number; moved: boolean }
    | { kind: "pan"; startX: number; startY: number; panX: number; panY: number }
    | null
  >(null);

  function onNodePointerDown(e: React.PointerEvent, node: FlowNode) {
    e.stopPropagation();
    dragRef.current = {
      kind: "node", id: node.id, startX: e.clientX, startY: e.clientY,
      nodeX: node.x, nodeY: node.y, moved: false,
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function onCanvasPointerDown(e: React.PointerEvent) {
    if (e.target !== e.currentTarget) return;
    dragRef.current = { kind: "pan", startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    setAddMenu(null);
    setIssuesOpen(null);
    setCallMenu(false);
    setGenMenu(false);
  }

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.kind === "node") {
      const dx = (e.clientX - d.startX) / zoomRef.current;
      const dy = (e.clientY - d.startY) / zoomRef.current;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      setFlow((f) => ({
        ...f,
        nodes: f.nodes.map((n) => (n.id === d.id ? { ...n, x: d.nodeX + dx, y: d.nodeY + dy } : n)),
      }));
    } else {
      setPan({ x: d.panX + (e.clientX - d.startX), y: d.panY + (e.clientY - d.startY) });
    }
  }, []);

  const onPointerUp = useCallback(() => {
    const d = dragRef.current;
    if (d?.kind === "node") {
      if (!d.moved) {
        setPanel({ kind: "node", id: d.id });
        setAddMenu(null);
      } else {
        setDirty(true);
      }
    }
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }, [onPointerMove]);

  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  function onWheel(e: React.WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      const next = Math.min(2, Math.max(0.35, zoom * (e.deltaY < 0 ? 1.08 : 0.92)));
      setZoom(next);
    } else {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }

  function fitView() {
    const el = viewportRef.current;
    if (!el || flow.nodes.length === 0) return;
    const xs = flow.nodes.map((n) => n.x);
    const ys = flow.nodes.map((n) => n.y);
    const minX = Math.min(...xs) - 60;
    const minY = Math.min(...ys) - 60;
    const maxX = Math.max(...xs) + NODE_W + 60;
    const maxY = Math.max(...ys) + NODE_H + 60;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const z = Math.min(1.2, Math.max(0.35, Math.min(w / (maxX - minX), h / (maxY - minY))));
    setZoom(z);
    setPan({ x: (w - (maxX - minX) * z) / 2 - minX * z, y: (h - (maxY - minY) * z) / 2 - minY * z });
  }

  function autoLayout() {
    mutate((f) => {
      const start = f.nodes.find((n) => n.type === "start");
      const order: FlowNode[] = [];
      const visited = new Set<string>();
      const queue = start ? [start] : [...f.nodes];
      while (queue.length) {
        const n = queue.shift()!;
        if (visited.has(n.id)) continue;
        visited.add(n.id);
        order.push(n);
        for (const e of f.edges.filter((e) => e.from === n.id)) {
          const t = f.nodes.find((x) => x.id === e.to);
          if (t && !visited.has(t.id)) queue.push(t);
        }
      }
      for (const n of f.nodes) if (!visited.has(n.id)) order.push(n);
      const nodes = f.nodes.map((n) => {
        const i = order.findIndex((o) => o.id === n.id);
        return { ...n, x: 460 + i * 105, y: 80 + i * 215 };
      });
      return { ...f, nodes };
    });
    setTimeout(fitView, 0);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current?.requestFullscreen().catch(() => {});
  }

  // --- Flow mutations --------------------------------------------------------

  function addNode(afterId: string, type: FlowNodeType) {
    const src = flow.nodes.find((n) => n.id === afterId);
    if (!src) return;
    const defaults = nodeDefaults(type);
    const node: FlowNode = {
      id: newFlowId("node"),
      type,
      label: defaults.label,
      x: src.x + 100,
      y: src.y + 220,
      data: defaults.data,
    };
    const edge: FlowEdge = {
      id: newFlowId("edge"),
      from: src.id,
      to: node.id,
      label: src.type === "webhook" ? "Success" : "",
      transitionType: src.type === "webhook" ? "nl" : "nl",
      condition: src.type === "webhook" ? "The webhook call succeeded" : "",
      backTransitionType: "always",
    };
    mutate((f) => ({ ...f, nodes: [...f.nodes, node], edges: [...f.edges, edge] }));
    setAddMenu(null);
    setPanel({ kind: "node", id: node.id });
  }

  function updateNode(id: string, patch: Partial<FlowNode>) {
    mutate((f) => ({ ...f, nodes: f.nodes.map((n) => (n.id === id ? { ...n, ...patch, data: { ...n.data, ...(patch.data ?? {}) } } : n)) }));
  }

  function deleteNode(id: string) {
    mutate((f) => ({
      ...f,
      nodes: f.nodes.filter((n) => n.id !== id),
      edges: f.edges.filter((e) => e.from !== id && e.to !== id),
    }));
    setPanel(null);
  }

  function updateEdge(id: string, patch: Partial<FlowEdge>) {
    mutate((f) => ({ ...f, edges: f.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  }

  function deleteEdge(id: string) {
    mutate((f) => ({ ...f, edges: f.edges.filter((e) => e.id !== id) }));
    setPanel(null);
  }

  async function save() {
    setBusy(true);
    const res = await fetch(`/api/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flow }),
    });
    setBusy(false);
    if (res.ok) {
      setDirty(false);
      toast("Flow saved — the agent now follows this conversation flow.");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toastError(data.error ?? "Could not save the flow.");
    }
  }

  function goBack() {
    if (dirty && !confirm("You have unsaved changes. Leave the Flow Designer anyway?")) return;
    router.push(`/dashboard/agents/${agent.id}`);
  }

  // --- Edge geometry ---------------------------------------------------------

  function anchors(e: FlowEdge) {
    const from = flow.nodes.find((n) => n.id === e.from);
    const to = flow.nodes.find((n) => n.id === e.to);
    if (!from || !to) return null;
    const x0 = from.x + NODE_W / 2;
    const y0 = from.y + NODE_H + 14;
    const x1 = to.x + NODE_W / 2;
    const y1 = to.y - 6;
    const c = Math.max(40, Math.min(120, (y1 - y0) / 2));
    return { x0, y0, x1, y1, c };
  }

  function edgeMidpoint(e: FlowEdge) {
    const a = anchors(e);
    if (!a) return { x: 0, y: 0 };
    // Cubic bezier midpoint at t = 0.5
    const mx = (a.x0 + 3 * a.x0 + 3 * a.x1 + a.x1) / 8;
    const my = (a.y0 + 3 * (a.y0 + a.c) + 3 * (a.y1 - a.c) + a.y1) / 8;
    return { x: mx, y: my };
  }

  const selectedNode = panel?.kind === "node" ? flow.nodes.find((n) => n.id === panel.id) : undefined;
  const selectedEdge = panel?.kind === "edge" ? flow.edges.find((e) => e.id === panel.id) : undefined;

  const bbox = useMemo(() => {
    if (flow.nodes.length === 0) return { minX: 0, minY: 0, w: 1000, h: 700 };
    const xs = flow.nodes.map((n) => n.x);
    const ys = flow.nodes.map((n) => n.y);
    const minX = Math.min(...xs) - 40;
    const minY = Math.min(...ys) - 40;
    return {
      minX, minY,
      w: Math.max(...xs) + NODE_W + 40 - minX,
      h: Math.max(...ys) + NODE_H + 40 - minY,
    };
  }, [flow.nodes]);

  return (
    <div ref={containerRef} className="fixed inset-0 z-40 flex bg-white text-ink-100">
      {/* Shrunken icon rail */}
      <aside className="flex w-12 shrink-0 flex-col items-center border-r border-ink-800 bg-white py-3">
        <span className="orb h-7 w-7" aria-hidden />
        <nav className="mt-6 flex flex-col items-center gap-1.5">
          {[
            { href: "/dashboard", icon: LayoutGrid, label: "Dashboard" },
            { href: "/dashboard/agents", icon: Bot, label: "AI Agents" },
            { href: "/dashboard/knowledge", icon: BookOpen, label: "Knowledge Bases" },
            { href: "/dashboard/launch", icon: Rocket, label: "Launch your AI" },
            { href: "/dashboard/phone-numbers", icon: Phone, label: "Phone Numbers" },
            { href: "/dashboard/contacts", icon: Users, label: "Contacts" },
            { href: "/dashboard/calls", icon: PhoneCall, label: "Call Logs" },
            { href: "/dashboard/live", icon: Radio, label: "Live Monitoring" },
            { href: "/dashboard/integrations", icon: Link2, label: "Integrations" },
            { href: "/dashboard/webhooks", icon: WebhookIcon, label: "Webhooks" },
          ].map((l) => (
            <Link key={l.href} href={l.href} title={l.label}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-800 hover:text-ink-100">
              <l.icon className="h-4 w-4" />
            </Link>
          ))}
        </nav>
        <div className="mt-auto">
          <Link href="/dashboard/settings" title="Settings"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-800 hover:text-ink-100">
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </aside>

      {/* Canvas area */}
      <div ref={viewportRef} className="relative min-w-0 flex-1 overflow-hidden flow-canvas-bg"
        onWheel={onWheel}>
        {/* Pannable / zoomable world */}
        <div
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          onPointerDown={onCanvasPointerDown}
        />
        <div
          className="pointer-events-none absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          {/* Edges */}
          <svg className="absolute overflow-visible" width={1} height={1} aria-hidden>
            {flow.edges.map((e) => {
              const a = anchors(e);
              if (!a) return null;
              return (
                <g key={e.id}>
                  <path
                    d={`M ${a.x0} ${a.y0} C ${a.x0} ${a.y0 + a.c}, ${a.x1} ${a.y1 - a.c}, ${a.x1} ${a.y1}`}
                    fill="none"
                    stroke="#6b7280"
                    strokeWidth={1.6}
                    strokeDasharray="5 5"
                  />
                  <circle cx={a.x0} cy={a.y0} r={4} fill="#fff" stroke="#6b7280" strokeWidth={1.5} />
                  <circle cx={a.x1} cy={a.y1} r={4} fill="#fff" stroke="#6b7280" strokeWidth={1.5} />
                </g>
              );
            })}
          </svg>

          {/* Edge label pills */}
          {flow.edges.map((e) => {
            const m = edgeMidpoint(e);
            const isSuccess = (e.label ?? "").toLowerCase() === "success";
            const text = e.label?.trim() || (e.condition?.trim() ? e.condition.slice(0, 26) : "Click to edit");
            return (
              <button
                key={e.id}
                onClick={() => setPanel({ kind: "edge", id: e.id })}
                className={`pointer-events-auto absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border bg-white px-3 py-1 text-xs font-semibold shadow-sm transition hover:shadow ${
                  isSuccess ? "border-emerald-400 text-emerald-600" : "border-ink-600 text-ink-200"
                }`}
                style={{ left: m.x, top: m.y }}
              >
                {isSuccess ? <CircleCheck className="h-3.5 w-3.5" /> : <Pencil className="h-3 w-3" />}
                {text}
              </button>
            );
          })}

          {/* Nodes */}
          {flow.nodes.map((node) => {
            const s = NODE_STYLE[node.type];
            const Icon = s.icon;
            const selected = panel?.kind === "node" && panel.id === node.id;
            const preview =
              node.type === "start" ? node.data.openingMessage :
              node.type === "prompt" ? node.data.goal :
              node.type === "webhook" ? node.data.url :
              node.type === "transfer" ? node.data.destination :
              node.data.closingMessage;
            const placeholder =
              node.type === "start" ? "Enter the start message..." :
              node.type === "prompt" ? "Enter instructions for the agent..." :
              node.type === "webhook" ? "Click to configure webhook" :
              node.type === "transfer" ? (node.data.transferType === "number" ? "Phone Number" : "SIP Trunk") :
              "Click to add closing message";
            return (
              <div
                key={node.id}
                className={`pointer-events-auto absolute select-none rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md ${s.card} ${
                  selected ? "ring-2 ring-[#301C3F]/40" : ""
                }`}
                style={{ left: node.x, top: node.y, width: NODE_W, cursor: "grab" }}
                onPointerDown={(e) => onNodePointerDown(e, node)}
              >
                <div className="flex items-center justify-center gap-2">
                  <Icon className={`h-4 w-4 ${s.title}`} />
                  <span className={`text-sm font-bold ${s.title}`}>
                    {node.type === "start" ? "Start Call" :
                     node.type === "prompt" ? "Prompt" :
                     node.type === "webhook" ? "Webhook" :
                     node.type === "transfer" ? "Transfer Call" : "End Call"}
                  </span>
                </div>
                <p className="mt-1 text-center text-xs text-ink-300">{node.label}</p>
                <div className={`mt-2.5 truncate rounded-lg border bg-white/80 px-3 py-2 text-center text-xs ${
                  preview?.trim() ? "text-ink-200" : "text-ink-400"
                } ${node.type === "webhook" || node.type === "end" ? "border-amber-200" : "border-ink-700"}`}>
                  {node.type === "transfer" && !preview?.trim() ? (
                    <span className="inline-flex items-center gap-1.5">
                      <GitBranch className="h-3 w-3" /> {placeholder}
                    </span>
                  ) : (
                    preview?.trim() || placeholder
                  )}
                </div>
                {node.type !== "end" && (
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setAddMenu(addMenu?.nodeId === node.id ? null : { nodeId: node.id });
                    }}
                    aria-label="Add next step"
                    className={`absolute -bottom-3.5 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border bg-white shadow-sm transition hover:scale-110 ${s.plus}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}

                {/* Add-node menu */}
                {addMenu?.nodeId === node.id && (
                  <div
                    className="absolute left-1/2 top-full z-20 mt-5 w-56 -translate-x-1/2 rounded-xl border border-ink-700 bg-white py-1.5 shadow-xl"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {ADD_NODE_OPTIONS.map((o) => (
                      <button
                        key={o.type}
                        onClick={(e) => { e.stopPropagation(); addNode(node.id, o.type); }}
                        className="flex w-full items-center gap-3 px-3.5 py-2 text-left transition hover:bg-ink-800"
                      >
                        <o.icon className="h-4 w-4 shrink-0 text-ink-400" />
                        <span>
                          <span className="block text-sm font-semibold">{o.title}</span>
                          <span className="block text-xs text-ink-400">{o.blurb}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Top bar */}
        <div className="absolute left-1/2 top-5 z-20 flex w-[min(1080px,92%)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-ink-800 bg-white px-4 py-2.5 shadow-lg shadow-black/5">
          <button onClick={goBack} className="flex items-center gap-1.5 text-sm text-ink-300 transition hover:text-ink-100">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <span className="h-6 w-px bg-ink-800" />
          <h1 className="truncate text-base font-bold">{agent.name || "New Conversation Flow"}</h1>
          <div className="ml-auto flex items-center gap-2">
            {errors.length > 0 && (
              <button onClick={() => setIssuesOpen(issuesOpen === "error" ? null : "error")}
                className="rounded-full bg-signal-red px-3 py-1 text-xs font-bold text-white">
                See Errors
              </button>
            )}
            {warnings.length > 0 && (
              <button onClick={() => setIssuesOpen(issuesOpen === "warning" ? null : "warning")}
                className="rounded-full border border-amber-400 px-3 py-1 text-xs font-bold text-amber-600">
                See Warnings
              </button>
            )}
            <div className="relative flex">
              <button onClick={() => setWebCall(true)}
                className="btn-secondary flex items-center gap-1.5 !rounded-r-none !py-2 !text-sm">
                <Phone className="h-4 w-4" /> Call
              </button>
              <button onClick={() => setCallMenu((v) => !v)} aria-label="Call options"
                className="btn-secondary !rounded-l-none !border-l-0 !px-2 !py-2">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {callMenu && (
                <div className="absolute right-0 top-11 z-30 w-48 rounded-xl border border-ink-700 bg-white py-1 shadow-xl">
                  <button onClick={() => { setCallMenu(false); setWebCall(true); }}
                    className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm hover:bg-ink-800">
                    <Bot className="h-4 w-4 text-ink-400" /> Web call
                  </button>
                  <button onClick={() => { setCallMenu(false); setPhoneCall(true); }}
                    className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm hover:bg-ink-800">
                    <Phone className="h-4 w-4 text-ink-400" /> Phone call
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => setTestPanel(true)} className="btn-secondary flex items-center gap-1.5 !py-2 !text-sm">
              <FlaskConical className="h-4 w-4" /> Evals
            </button>
            <div className="relative flex">
              <button onClick={() => setGenerateOpen(true)}
                className="btn-secondary flex items-center gap-1.5 !rounded-r-none !py-2 !text-sm">
                <Sparkles className="h-4 w-4" /> Generate
              </button>
              <button onClick={() => setGenMenu((v) => !v)} aria-label="Generate options"
                className="btn-secondary !rounded-l-none !border-l-0 !px-2 !py-2">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {genMenu && (
                <div className="absolute right-0 top-11 z-30 w-56 rounded-xl border border-ink-700 bg-white py-1 shadow-xl">
                  <button onClick={() => { setGenMenu(false); setGenerateOpen(true); }}
                    className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm hover:bg-ink-800">
                    <Sparkles className="h-4 w-4 text-ink-400" /> Generate flow with AI
                  </button>
                  <button onClick={() => { setGenMenu(false); autoLayout(); }}
                    className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm hover:bg-ink-800">
                    <LayoutGrid className="h-4 w-4 text-ink-400" /> Auto layout nodes
                  </button>
                </div>
              )}
            </div>
            <button onClick={save} disabled={busy} className="btn-primary flex items-center gap-1.5 !py-2 !text-sm disabled:opacity-60">
              <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {/* Issues dropdown */}
        {issuesOpen && (
          <div className="absolute left-1/2 top-20 z-20 w-[min(560px,90%)] -translate-x-1/2 rounded-xl border border-ink-700 bg-white p-3 shadow-xl">
            <p className="mb-2 flex items-center gap-2 text-sm font-bold">
              <CircleAlert className={`h-4 w-4 ${issuesOpen === "error" ? "text-signal-red" : "text-amber-500"}`} />
              {issuesOpen === "error" ? `${errors.length} error${errors.length === 1 ? "" : "s"}` : `${warnings.length} warning${warnings.length === 1 ? "" : "s"}`}
            </p>
            <ul className="space-y-1">
              {(issuesOpen === "error" ? errors : warnings).map((i, idx) => (
                <li key={idx}>
                  <button
                    onClick={() => {
                      if (i.nodeId) setPanel({ kind: "node", id: i.nodeId });
                      setIssuesOpen(null);
                    }}
                    className="w-full rounded-lg px-3 py-1.5 text-left text-sm text-ink-200 transition hover:bg-ink-800"
                  >
                    {i.message}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Bottom-left menu */}
        <div className="absolute bottom-6 left-6 z-20 w-40 rounded-xl border border-ink-800 bg-white py-1 shadow-lg">
          <button onClick={() => setPanel({ kind: "variables" })}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition hover:bg-ink-800">
            <Braces className="h-4 w-4 text-ink-400" /> Variables
          </button>
          <button onClick={() => setPanel({ kind: "globalTools" })}
            className="flex w-full items-center gap-2.5 border-t border-ink-800 px-3.5 py-2 text-left text-sm transition hover:bg-ink-800">
            <Wrench className="h-4 w-4 text-ink-400" /> Global Tools
            <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#301C3F] px-1 text-[10px] font-bold text-white">
              {flow.globalTools.length}
            </span>
          </button>
          <button onClick={() => setPanel({ kind: "share" })}
            className="flex w-full items-center gap-2.5 border-t border-ink-800 px-3.5 py-2 text-left text-sm transition hover:bg-ink-800">
            <Share2 className="h-4 w-4 text-ink-400" /> Share
          </button>
          <button onClick={() => setPanel({ kind: "embed" })}
            className="flex w-full items-center gap-2.5 border-t border-ink-800 px-3.5 py-2 text-left text-sm transition hover:bg-ink-800">
            <Code2 className="h-4 w-4 text-ink-400" /> Embed
          </button>
          <button onClick={() => setWebCall(true)}
            className="flex w-full items-center gap-2.5 border-t border-ink-800 px-3.5 py-2 text-left text-sm transition hover:bg-ink-800">
            <MessageSquare className="h-4 w-4 text-ink-400" /> Test
          </button>
        </div>

        {/* Bottom-center controls */}
        <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center overflow-hidden rounded-xl border border-ink-800 bg-white shadow-lg">
          <button onClick={() => setZoom((z) => Math.max(0.35, z * 0.85))} title="Zoom out"
            className="flex h-10 w-10 items-center justify-center text-ink-300 transition hover:bg-ink-800"><ZoomOut className="h-4 w-4" /></button>
          <button onClick={() => setZoom((z) => Math.min(2, z * 1.18))} title="Zoom in"
            className="flex h-10 w-10 items-center justify-center text-ink-300 transition hover:bg-ink-800"><ZoomIn className="h-4 w-4" /></button>
          <button onClick={fitView} title="Fit view"
            className="flex h-10 w-10 items-center justify-center text-ink-300 transition hover:bg-ink-800"><Crosshair className="h-4 w-4" /></button>
          <button onClick={toggleFullscreen} title="Fullscreen"
            className="flex h-10 w-10 items-center justify-center text-ink-300 transition hover:bg-ink-800"><Maximize className="h-4 w-4" /></button>
          <button onClick={autoLayout} title="Auto layout"
            className="flex h-10 w-10 items-center justify-center text-ink-300 transition hover:bg-ink-800"><LayoutGrid className="h-4 w-4" /></button>
        </div>

        {/* Minimap */}
        <div className="absolute bottom-6 right-6 z-20 h-24 w-40 overflow-hidden rounded-xl border border-ink-800 bg-white/90 shadow-lg">
          {flow.nodes.map((n) => {
            const scale = Math.min(152 / bbox.w, 88 / bbox.h);
            return (
              <span
                key={n.id}
                className={`absolute rounded-[2px] ${
                  n.type === "start" ? "bg-emerald-300" :
                  n.type === "prompt" ? "bg-blue-300" :
                  n.type === "webhook" ? "bg-amber-300" :
                  n.type === "transfer" ? "bg-violet-300" : "bg-rose-300"
                }`}
                style={{
                  left: 4 + (n.x - bbox.minX) * scale,
                  top: 4 + (n.y - bbox.minY) * scale,
                  width: Math.max(6, NODE_W * scale),
                  height: Math.max(4, NODE_H * scale),
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Right panels */}
      {selectedNode && (
        <NodePanel
          key={selectedNode.id}
          node={selectedNode}
          knowledgeBases={knowledgeBases}
          globalToolCount={flow.globalTools.length}
          onSave={(patch) => { updateNode(selectedNode.id, patch); setPanel(null); }}
          onDelete={selectedNode.type === "start" ? undefined : () => deleteNode(selectedNode.id)}
          onClose={() => setPanel(null)}
        />
      )}
      {selectedEdge && (
        <EdgePanel
          key={selectedEdge.id}
          edge={selectedEdge}
          fromLabel={flow.nodes.find((n) => n.id === selectedEdge.from)?.label ?? "?"}
          toLabel={flow.nodes.find((n) => n.id === selectedEdge.to)?.label ?? "?"}
          onSave={(patch) => { updateEdge(selectedEdge.id, patch); setPanel(null); }}
          onDelete={() => deleteEdge(selectedEdge.id)}
          onClose={() => setPanel(null)}
        />
      )}
      {panel?.kind === "variables" && (
        <VariablesPanel flow={flow} onClose={() => setPanel(null)} />
      )}
      {panel?.kind === "globalTools" && (
        <GlobalToolsPanel
          tools={flow.globalTools}
          onChange={(tools) => mutate((f) => ({ ...f, globalTools: tools }))}
          onClose={() => setPanel(null)}
        />
      )}
      {panel?.kind === "share" && (
        <SharePanel agentId={agent.id} embed={false} onClose={() => setPanel(null)} />
      )}
      {panel?.kind === "embed" && (
        <SharePanel agentId={agent.id} embed onClose={() => setPanel(null)} />
      )}

      {/* Modals */}
      {generateOpen && (
        <GenerateFlowModal
          onClose={() => setGenerateOpen(false)}
          onGenerated={(f) => {
            setFlow(f);
            setDirty(true);
            setGenerateOpen(false);
            setTimeout(fitView, 0);
            toast("Flow generated — review the steps, then Save.");
          }}
        />
      )}
      {webCall && <WebCallModal agent={agent} onClose={() => setWebCall(false)} />}
      {phoneCall && (
        <PhoneTestCallModal agent={agent} phoneNumbers={phoneNumbers} onClose={() => setPhoneCall(false)} />
      )}
      {testPanel && (
        <TestAgentPanel agents={[agent]} initialAgentId={agent.id} onClose={() => setTestPanel(false)} />
      )}
    </div>
  );
}

// --- Right slide-over shell --------------------------------------------------

function PanelShell({
  title,
  subtitle,
  icon,
  onClose,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-y-0 right-0 z-30 flex w-full max-w-xl flex-col border-l border-ink-700 bg-white shadow-2xl">
      <div className="flex items-start justify-between px-6 pb-4 pt-5">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">{icon}{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-400">{subtitle}</p>}
        </div>
        <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 pb-6">{children}</div>
      {footer && (
        <div className="flex items-center justify-between border-t border-ink-800 px-6 py-4">{footer}</div>
      )}
    </div>
  );
}

// --- Node editor panel -------------------------------------------------------

function NodePanel({
  node,
  knowledgeBases,
  globalToolCount,
  onSave,
  onDelete,
  onClose,
}: {
  node: FlowNode;
  knowledgeBases: KnowledgeBase[];
  globalToolCount: number;
  onSave: (patch: Partial<FlowNode>) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(node.label);
  const [data, setData] = useState({ ...node.data });
  const [tab, setTab] = useState<"General" | "KB" | "Tools" | "Extract">("General");
  const [kbSearch, setKbSearch] = useState("");
  const [toolMenu, setToolMenu] = useState(false);

  const set = (patch: Partial<FlowNode["data"]>) => setData((d) => ({ ...d, ...patch }));

  const titles: Record<FlowNodeType, { title: string; sub: string; icon: React.ReactNode }> = {
    start: {
      title: "Edit Start Call Node",
      sub: "Initial greeting message when the call starts. This is the first thing the AI agent will say.",
      icon: <Phone className="h-4 w-4 text-emerald-500" />,
    },
    prompt: {
      title: "Edit Instruction Node",
      sub: "Instructions for the AI agent. Define what the agent should say or do at this point in the conversation.",
      icon: <MessageCircle className="h-4 w-4 text-blue-500" />,
    },
    webhook: {
      title: "Edit Function/Webhook Node",
      sub: "Call a webhook or function to integrate with external services and process data.",
      icon: <SquareFunction className="h-4 w-4 text-amber-500" />,
    },
    transfer: {
      title: "Edit Transfer Call Node",
      sub: "Transfer the call to another agent or phone number when specific conditions are met.",
      icon: <PhoneForwarded className="h-4 w-4 text-violet-500" />,
    },
    end: {
      title: "Edit End Call Node",
      sub: "End the call with a closing message and perform any cleanup actions.",
      icon: <PhoneOff className="h-4 w-4 text-rose-500" />,
    },
  };

  const extractCount = data.extract?.length ?? 0;

  return (
    <PanelShell
      title={titles[node.type].title}
      subtitle={titles[node.type].sub}
      icon={titles[node.type].icon}
      onClose={onClose}
      footer={
        <>
          {onDelete ? (
            <button onClick={onDelete} className="flex items-center gap-1.5 text-sm font-medium text-signal-red hover:underline">
              <Trash2 className="h-4 w-4" /> Delete Node
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={() => onSave({ label, data })} className="btn-primary flex items-center gap-1.5">
              <Save className="h-4 w-4" /> Save Changes
            </button>
          </div>
        </>
      }
    >
      {node.type === "prompt" && (
        <div className="mb-5 grid grid-cols-4 rounded-lg bg-ink-800/60 p-0.5">
          {(["General", "KB", "Tools", "Extract"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition ${
                tab === t ? "bg-white shadow-sm" : "text-ink-400 hover:text-ink-200"
              }`}>
              {t}
              {t === "Extract" && extractCount > 0 && (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#301C3F] px-1 text-[10px] font-bold text-white">{extractCount}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {(node.type !== "prompt" || tab === "General") && (
        <div className="space-y-5">
          <div>
            <label className="label">Node Label</label>
            <input className="field" value={label} onChange={(e) => setLabel(e.target.value)} />
            <p className="mt-1 text-xs text-ink-400">A descriptive name for this node to identify it in the flow.</p>
          </div>

          {node.type === "start" && (
            <>
              <div>
                <label className="label">Opening Message</label>
                <textarea rows={3} className="field font-mono !text-[13px]"
                  placeholder="Hello! Thank you for calling. How can I help you today?"
                  value={data.openingMessage} onChange={(e) => set({ openingMessage: e.target.value })} />
                <p className="mt-1 text-xs text-ink-400">The first message spoken when the call starts. Make it welcoming and clear.</p>
              </div>
              <div>
                <label className="label">Conversation Goal</label>
                <textarea rows={5} className="field font-mono !text-[13px]"
                  placeholder="Help the customer schedule an appointment, collect their contact information, and confirm the booking details..."
                  value={data.goal} onChange={(e) => set({ goal: e.target.value })} />
                <p className="mt-1 text-xs text-ink-400">Define what the agent should accomplish during this call. This guides the agent&apos;s behavior and objectives.</p>
              </div>
              <p className="flex items-start gap-2 rounded-xl border border-ink-800 bg-ink-800/40 px-4 py-3 text-sm text-ink-300">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                The opening message is spoken first. The conversation goal defines what the agent should accomplish during the call.
              </p>
            </>
          )}

          {node.type === "prompt" && (
            <div>
              <label className="label">Conversation Goal</label>
              <textarea rows={8} className="field font-mono !text-[13px]"
                placeholder="Extend the system prompt with instructions specific to this conversation node..."
                value={data.goal} onChange={(e) => set({ goal: e.target.value })} />
              <p className="mt-1 text-xs text-ink-400">Provide clear instructions for what the AI should say or do at this step.</p>
            </div>
          )}

          {node.type === "webhook" && (
            <>
              <div>
                <label className="label">HTTP Method</label>
                <select className="field" value={data.method} onChange={(e) => set({ method: e.target.value as "GET" | "POST" | "PUT" })}>
                  {["POST", "GET", "PUT"].map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Webhook URL</label>
                <input className="field font-mono !text-[13px]" placeholder="https://api.example.com/webhook"
                  value={data.url} onChange={(e) => set({ url: e.target.value })} />
                <p className="mt-1 text-xs text-ink-400">The endpoint URL to call when this node is reached.</p>
              </div>
              <div>
                <label className="label">Headers (JSON)</label>
                <textarea rows={3} className="field font-mono !text-[13px]"
                  placeholder='{"Authorization": "Bearer ...", "Content-Type": "application/json"}'
                  value={data.headers} onChange={(e) => set({ headers: e.target.value })} />
                <p className="mt-1 text-xs text-ink-400">Optional HTTP headers in JSON format.</p>
              </div>
              <div>
                <label className="label">Request Body (JSON)</label>
                <textarea rows={4} className="field font-mono !text-[13px]"
                  placeholder='{"customer_id": "{{caller_id}}", "status": "completed"}'
                  value={data.body} onChange={(e) => set({ body: e.target.value })} />
                <p className="mt-1 text-xs text-ink-400">Request body in JSON format. Use {"{{variable}}"} for dynamic values.</p>
              </div>
              <p className="flex items-start gap-2 rounded-xl border border-ink-800 bg-ink-800/40 px-4 py-3 text-sm text-ink-300">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                Webhooks allow you to integrate with external services. The response can be used in subsequent nodes.
              </p>
            </>
          )}

          {node.type === "transfer" && (
            <>
              <div>
                <label className="label">Transfer Type</label>
                <select className="field" value={data.transferType}
                  onChange={(e) => set({ transferType: e.target.value as "sip" | "number" })}>
                  <option value="sip">SIP Trunk</option>
                  <option value="number">Phone Number</option>
                </select>
                <p className="mt-1 text-xs text-ink-400">Choose the method for transferring the call.</p>
              </div>
              <div>
                <label className="label">{data.transferType === "number" ? "Phone Number" : "SIP Address"}</label>
                <input className="field font-mono !text-[13px]"
                  placeholder={data.transferType === "number" ? "+15550123456" : "sip:EXTENSION@SIP_SERVER:PORT"}
                  value={data.destination} onChange={(e) => set({ destination: e.target.value })} />
                <p className="mt-1 text-xs text-ink-400">
                  {data.transferType === "number"
                    ? "The human phone number to transfer to, with country code."
                    : "Enter SIP address (e.g., sip:1000@12.34.56.78:5060)"}
                </p>
              </div>
              <div>
                <label className="label">AI Message Before Transfer</label>
                <textarea rows={3} className="field"
                  placeholder="Please hold while I transfer you to our specialist..."
                  value={data.message} onChange={(e) => set({ message: e.target.value })} />
                <p className="mt-1 text-xs text-ink-400">Optional message the AI will say before initiating the transfer.</p>
              </div>
              <p className="flex items-start gap-2 rounded-xl border border-ink-800 bg-ink-800/40 px-4 py-3 text-sm text-ink-300">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                Transfer nodes will move the call to the specified target. Make sure the destination is properly configured.
              </p>
            </>
          )}

          {node.type === "end" && (
            <>
              <div>
                <label className="label">Closing Message</label>
                <textarea rows={3} className="field"
                  placeholder="Thank you for calling! Have a great day. Goodbye!"
                  value={data.closingMessage} onChange={(e) => set({ closingMessage: e.target.value })} />
                <p className="mt-1 text-xs text-ink-400">The final message the AI will say before ending the call.</p>
              </div>
              <p className="flex items-start gap-2 rounded-xl border border-ink-800 bg-ink-800/40 px-4 py-3 text-sm text-ink-300">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                This node ends the call. The AI will speak the closing message, then the conversation will terminate.
              </p>
            </>
          )}
        </div>
      )}

      {node.type === "prompt" && tab === "KB" && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Knowledge Base</p>
              <p className="mt-0.5 text-xs text-ink-400">
                Select a specific knowledge base for this node, or leave empty to use the agent&apos;s default knowledge base.
              </p>
            </div>
            <button onClick={() => window.open("/dashboard/knowledge", "_blank")}
              className="btn-secondary flex shrink-0 items-center gap-1.5 !text-sm">
              <Plus className="h-3.5 w-3.5" /> Add KB
            </button>
          </div>
          <div className="rounded-xl border border-ink-800 p-3">
            <input className="field !py-2" placeholder="Search knowledge bases..."
              value={kbSearch} onChange={(e) => setKbSearch(e.target.value)} />
            <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
              {knowledgeBases
                .filter((k) => !kbSearch || k.name.toLowerCase().includes(kbSearch.toLowerCase()))
                .map((k) => {
                  const checked = data.kbIds?.includes(k.id) ?? false;
                  return (
                    <label key={k.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-ink-800">
                      <input type="checkbox" checked={checked}
                        onChange={() => set({
                          kbIds: checked ? (data.kbIds ?? []).filter((x) => x !== k.id) : [...(data.kbIds ?? []), k.id],
                        })}
                        className="h-3.5 w-3.5 rounded border-ink-600" />
                      <BookOpen className="h-3.5 w-3.5 text-ink-400" />
                      <span className="truncate text-sm">{k.name}</span>
                    </label>
                  );
                })}
              {knowledgeBases.length === 0 && (
                <p className="py-6 text-center text-sm text-ink-400">No knowledge bases yet.</p>
              )}
            </div>
          </div>
          <p className="flex items-start gap-2 rounded-xl border border-ink-800 bg-ink-800/40 px-4 py-3 text-sm text-ink-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            {data.kbIds?.length
              ? `${data.kbIds.length} knowledge base${data.kbIds.length === 1 ? "" : "s"} selected for this node.`
              : "Using the agent's default knowledge base. Select knowledge bases above to override."}
          </p>
        </div>
      )}

      {node.type === "prompt" && tab === "Tools" && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold">Tools</p>
            <p className="mt-0.5 text-xs text-ink-400">Add tools that will be available at this node.</p>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-800 px-4 py-3">
            <input type="checkbox" checked={data.includeGlobalTools !== false}
              onChange={(e) => set({ includeGlobalTools: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-ink-600" />
            <span>
              <span className="block text-sm font-semibold">Include Global Tools</span>
              <span className="block text-xs text-ink-400">
                When enabled, global tools configured at the flow level ({globalToolCount}) will also be available at this node.
              </span>
            </span>
          </label>
          <div className="rounded-xl border border-ink-800 p-4">
            <div className="relative flex justify-end">
              <button onClick={() => setToolMenu((v) => !v)} className="btn-secondary flex items-center gap-1.5 !text-sm">
                <Plus className="h-3.5 w-3.5" /> Add Tool
              </button>
              {toolMenu && (
                <div className="absolute right-0 top-10 z-10 w-64 rounded-xl border border-ink-700 bg-white py-1 shadow-xl">
                  {GLOBAL_TOOL_OPTIONS.map((o) => (
                    <button key={o.type}
                      onClick={() => {
                        set({
                          tools: [...(data.tools ?? []), {
                            id: newFlowId("tool"), type: o.type, title: o.title,
                            name: o.type, description: o.blurb, aiResponse: "", config: {},
                          } as AgentTool],
                        });
                        setToolMenu(false);
                      }}
                      className="flex w-full flex-col px-3.5 py-2 text-left transition hover:bg-ink-800">
                      <span className="text-sm font-semibold">{o.title}</span>
                      <span className="text-xs text-ink-400">{o.blurb}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {(data.tools?.length ?? 0) === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-ink-600 py-10 text-center text-sm text-ink-400">
                <Info className="mx-auto mb-2 h-5 w-5" />
                No tools configured
                <span className="block text-xs">Add tools to enhance your agent&apos;s capabilities</span>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {(data.tools ?? []).map((t, i) => (
                  <div key={t.id ?? i} className="flex items-center justify-between rounded-lg border border-ink-800 px-3 py-2">
                    <span>
                      <span className="text-sm font-semibold">{t.title}</span>
                      <span className="ml-2 rounded bg-[#301C3F]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#301C3F]">{t.type}</span>
                    </span>
                    <button onClick={() => set({ tools: (data.tools ?? []).filter((_, j) => j !== i) })}
                      aria-label="Remove tool" className="p-1 text-ink-400 hover:text-signal-red"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="flex items-start gap-2 rounded-xl border border-ink-800 bg-ink-800/40 px-4 py-3 text-sm text-ink-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            {(data.tools?.length ?? 0) === 0
              ? 'No tools configured for this node. Click "Add Tool" to add tools that will be available at this step.'
              : `${data.tools!.length} tool${data.tools!.length === 1 ? "" : "s"} available at this step.`}
          </p>
        </div>
      )}

      {node.type === "prompt" && tab === "Extract" && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Extracted Variables</p>
              <p className="mt-0.5 text-xs text-ink-400">
                Extract data from the conversation. These will be available as dynamic variables for the rest of the workflow.
              </p>
            </div>
            <button
              onClick={() => set({ extract: [...(data.extract ?? []), { name: "", type: "String", description: "", possibleValues: [] }] })}
              className="btn-secondary flex shrink-0 items-center gap-1.5 !text-sm">
              <Plus className="h-3.5 w-3.5" /> Add Variable
            </button>
          </div>
          {(data.extract ?? []).map((v, i) => (
            <ExtractVarCard key={i} v={v}
              onChange={(nv) => set({ extract: (data.extract ?? []).map((x, j) => (j === i ? nv : x)) })}
              onRemove={() => set({ extract: (data.extract ?? []).filter((_, j) => j !== i) })}
            />
          ))}
          <p className="flex items-start gap-2 rounded-xl border border-ink-800 bg-ink-800/40 px-4 py-3 text-sm text-ink-300">
            <Braces className="mt-0.5 h-4 w-4 shrink-0" />
            Extracted variables will be available as {"{{variable_name}}"} in subsequent nodes and can be used in prompts, webhooks, or transferred to external systems.
          </p>
        </div>
      )}
    </PanelShell>
  );
}

function ExtractVarCard({
  v,
  onChange,
  onRemove,
}: {
  v: { name: string; type: string; description?: string; possibleValues?: string[] };
  onChange: (v: { name: string; type: string; description?: string; possibleValues?: string[] }) => void;
  onRemove: () => void;
}) {
  const [pv, setPv] = useState("");
  return (
    <div className="rounded-xl border border-ink-800 p-4">
      <div className="flex items-center justify-between">
        <label className="label !mb-0">Variable Name</label>
        <button onClick={onRemove} aria-label="Remove variable" className="p-1 text-signal-red hover:opacity-80">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="font-mono text-sm text-ink-400">{"{{"}</span>
        <input className="field flex-1 font-mono !text-[13px]" placeholder="e.g., order_number"
          value={v.name} onChange={(e) => onChange({ ...v, name: e.target.value.replace(/[^\w.-]/g, "_") })} />
        <span className="font-mono text-sm text-ink-400">{"}}"}</span>
      </div>
      <label className="label mt-3">Type</label>
      <select className="field" value={v.type} onChange={(e) => onChange({ ...v, type: e.target.value })}>
        {["String", "Number", "Boolean"].map((t) => <option key={t}>{t}</option>)}
      </select>
      <label className="label mt-3">Description (optional)</label>
      <input className="field" placeholder="Brief description of what this variable represents"
        value={v.description ?? ""} onChange={(e) => onChange({ ...v, description: e.target.value })} />
      <label className="label mt-3">Possible Values (optional)</label>
      <p className="mb-1.5 text-xs text-ink-400">Restrict to specific values. Leave empty for any string.</p>
      {(v.possibleValues?.length ?? 0) > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {v.possibleValues!.map((p, i) => (
            <span key={i} className="flex items-center gap-1 rounded-full bg-[#301C3F]/10 px-2.5 py-1 text-xs font-medium text-[#301C3F]">
              {p}
              <button onClick={() => onChange({ ...v, possibleValues: v.possibleValues!.filter((_, j) => j !== i) })}
                aria-label={`Remove ${p}`}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
      <input className="field" placeholder="Add a possible value" value={pv}
        onChange={(e) => setPv(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && pv.trim()) {
            onChange({ ...v, possibleValues: [...(v.possibleValues ?? []), pv.trim()] });
            setPv("");
          }
        }} />
      <p className="mt-1 text-xs text-ink-400">Press Enter to add</p>
    </div>
  );
}

// --- Edge editor panel -------------------------------------------------------

function EdgePanel({
  edge,
  fromLabel,
  toLabel,
  onSave,
  onDelete,
  onClose,
}: {
  edge: FlowEdge;
  fromLabel: string;
  toLabel: string;
  onSave: (patch: Partial<FlowEdge>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"Forward Path" | "Backward Path">("Forward Path");
  const [transitionType, setTransitionType] = useState(edge.transitionType);
  const [label, setLabel] = useState(edge.label ?? "");
  const [condition, setCondition] = useState(edge.condition ?? "");
  const [backType, setBackType] = useState(edge.backTransitionType ?? "always");
  const [backCondition, setBackCondition] = useState(edge.backCondition ?? "");

  return (
    <PanelShell
      title="Configure Edge Connection"
      subtitle={`Set up the connection from ${fromLabel} to ${toLabel}`}
      icon={<GitBranch className="h-4 w-4 text-ink-300" />}
      onClose={onClose}
      footer={
        <>
          <button onClick={onDelete} className="flex items-center gap-1.5 text-sm font-medium text-signal-red hover:underline">
            <Trash2 className="h-4 w-4" /> Delete Edge
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              onClick={() => onSave({ transitionType, label, condition, backTransitionType: backType, backCondition })}
              className="btn-primary flex items-center gap-1.5">
              <Save className="h-4 w-4" /> Save Changes
            </button>
          </div>
        </>
      }
    >
      <div className="mb-5 grid grid-cols-2 rounded-lg bg-ink-800/60 p-0.5">
        {(["Forward Path", "Backward Path"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-md py-2 text-sm font-medium transition ${
              tab === t ? "bg-white shadow-sm" : "text-ink-400 hover:text-ink-200"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Forward Path" ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-400">Configure conditions for moving forward through this edge.</p>
          <div>
            <label className="label">Transition Type</label>
            <select className="field" value={transitionType}
              onChange={(e) => setTransitionType(e.target.value as "nl" | "always")}>
              <option value="nl">Natural Language Condition</option>
              <option value="always">None (Always)</option>
            </select>
          </div>
          {transitionType === "nl" ? (
            <>
              <div>
                <label className="label">Edge Label</label>
                <input className="field" placeholder="Click to edit"
                  value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div>
                <label className="label">Natural Language Condition</label>
                <textarea rows={4} className="field"
                  placeholder="Describe the condition in natural language, e.g., 'When the user wants to talk to support' or 'If the customer mentions a billing issue'"
                  value={condition} onChange={(e) => setCondition(e.target.value)} />
                <p className="mt-1 text-xs text-ink-400">Define when this path should be taken based on user intent or conversation context.</p>
              </div>
            </>
          ) : (
            <p className="rounded-xl bg-ink-800/50 px-4 py-3 text-sm text-ink-300">
              This edge will always be followed without any conditions.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-400">
            Configure conditions for returning backward through this edge (e.g., retry or correction flows).
          </p>
          <div>
            <label className="label">Transition Type</label>
            <select className="field" value={backType}
              onChange={(e) => setBackType(e.target.value as "nl" | "always")}>
              <option value="always">None (Always)</option>
              <option value="nl">Natural Language Condition</option>
            </select>
          </div>
          {backType === "nl" ? (
            <div>
              <label className="label">Natural Language Condition</label>
              <textarea rows={4} className="field"
                placeholder="Describe when the conversation should return to the previous step"
                value={backCondition} onChange={(e) => setBackCondition(e.target.value)} />
            </div>
          ) : (
            <p className="rounded-xl bg-ink-800/50 px-4 py-3 text-sm text-ink-300">
              This edge will always be followed without any conditions.
            </p>
          )}
        </div>
      )}
    </PanelShell>
  );
}

// --- Variables panel ---------------------------------------------------------

function VariablesPanel({ flow, onClose }: { flow: ConversationFlow; onClose: () => void }) {
  const custom = detectCustomVars(flow);
  return (
    <PanelShell
      title="Dynamic Variables"
      subtitle="Use these variables in your prompts to insert dynamic content"
      onClose={onClose}
    >
      <p className="mb-3 text-sm font-semibold">Predefined Variables</p>
      <div className="space-y-2">
        {PREDEFINED_FLOW_VARS.map((v) => (
          <div key={v.name} className="flex items-center justify-between rounded-xl border border-ink-800 px-4 py-3">
            <span>
              <code className="font-mono text-sm font-semibold text-[#301C3F]">{`{{${v.name}}}`}</code>
              <span className="block text-xs text-ink-400">{v.description}</span>
            </span>
            <button
              onClick={() => { navigator.clipboard.writeText(`{{${v.name}}}`); toast(`Copied {{${v.name}}}`); }}
              aria-label={`Copy ${v.name}`}
              className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100">
              <Copy className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <p className="mb-3 mt-6 text-sm font-semibold">Custom Variables</p>
      {custom.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-600 py-10 text-center text-sm text-ink-400">
          <Braces className="mx-auto mb-2 h-6 w-6" />
          No custom variables detected in your flow
          <span className="block text-xs">Add {"{{variable_name}}"} to any prompt to create custom variables</span>
        </div>
      ) : (
        <div className="space-y-2">
          {custom.map((name) => (
            <div key={name} className="flex items-center justify-between rounded-xl border border-ink-800 px-4 py-3">
              <code className="font-mono text-sm font-semibold text-[#301C3F]">{`{{${name}}}`}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(`{{${name}}}`); toast(`Copied {{${name}}}`); }}
                aria-label={`Copy ${name}`}
                className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100">
                <Copy className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

// --- Global tools panel ------------------------------------------------------

function GlobalToolsPanel({
  tools,
  onChange,
  onClose,
}: {
  tools: AgentTool[];
  onChange: (tools: AgentTool[]) => void;
  onClose: () => void;
}) {
  const [addMenu, setAddMenu] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);

  return (
    <PanelShell
      title="Global Tools"
      subtitle="Configure tools that can be used across all nodes in your flow"
      onClose={onClose}
    >
      <div className="rounded-xl border border-ink-800 p-4">
        <div className="relative flex justify-end">
          <button onClick={() => setAddMenu((v) => !v)} className="btn-secondary flex items-center gap-1.5 !text-sm">
            <Plus className="h-3.5 w-3.5" /> Add Tool
          </button>
          {addMenu && (
            <div className="absolute right-0 top-10 z-10 w-72 rounded-xl border border-ink-700 bg-white py-1 shadow-xl">
              {GLOBAL_TOOL_OPTIONS.map((o) => (
                <button key={o.type}
                  onClick={() => {
                    onChange([...tools, {
                      id: newFlowId("tool"), type: o.type, title: o.title, name: o.type,
                      description: o.blurb, aiResponse: "", config: {},
                    } as AgentTool]);
                    setAddMenu(false);
                  }}
                  className="flex w-full flex-col px-3.5 py-2 text-left transition hover:bg-ink-800">
                  <span className="text-sm font-semibold">{o.title}</span>
                  <span className="text-xs text-ink-400">{o.blurb}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-3 space-y-2">
          {tools.length === 0 && (
            <p className="rounded-xl border border-dashed border-ink-600 py-10 text-center text-sm text-ink-400">
              No global tools yet — add one above.
            </p>
          )}
          {tools.map((t, i) => (
            <div key={t.id ?? i} className="rounded-xl border border-ink-800 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{t.title}</span>
                  <span className="rounded-full bg-fuchsia-100 px-2 py-0.5 text-[10px] font-bold text-fuchsia-700">{t.title}</span>
                </span>
                <span className="flex items-center gap-1">
                  <button onClick={() => setEditing(editing === i ? null : i)} aria-label="Configure tool"
                    className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100">
                    <Settings className="h-4 w-4" />
                  </button>
                  <button onClick={() => onChange(tools.filter((_, j) => j !== i))} aria-label="Remove tool"
                    className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-signal-red">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-400">{t.description}</p>
              {editing === i && (
                <div className="mt-3 space-y-3 border-t border-ink-800 pt-3">
                  <div>
                    <label className="label !text-xs">What the agent says when using it</label>
                    <input className="field !py-2 !text-[13px]" value={t.aiResponse}
                      onChange={(e) => onChange(tools.map((x, j) => (j === i ? { ...x, aiResponse: e.target.value } : x)))} />
                  </div>
                  {t.type === "transfer_call" && (
                    <div>
                      <label className="label !text-xs">Transfer to phone number</label>
                      <input className="field !py-2 font-mono !text-[13px]" placeholder="+15550123456"
                        value={t.config?.phoneNumber ?? ""}
                        onChange={(e) => onChange(tools.map((x, j) => (j === i ? { ...x, config: { ...x.config, phoneNumber: e.target.value } } : x)))} />
                    </div>
                  )}
                  {t.type === "live_webhook" && (
                    <div>
                      <label className="label !text-xs">Webhook URL</label>
                      <input className="field !py-2 font-mono !text-[13px]" placeholder="https://api.example.com/webhook"
                        value={t.config?.url ?? ""}
                        onChange={(e) => onChange(tools.map((x, j) => (j === i ? { ...x, config: { ...x.config, url: e.target.value } } : x)))} />
                    </div>
                  )}
                  {t.type === "send_email" && (
                    <div>
                      <label className="label !text-xs">Email subject</label>
                      <input className="field !py-2 !text-[13px]" placeholder="Your appointment details"
                        value={t.config?.emailSubject ?? ""}
                        onChange={(e) => onChange(tools.map((x, j) => (j === i ? { ...x, config: { ...x.config, emailSubject: e.target.value } } : x)))} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </PanelShell>
  );
}

// --- Share / Embed panel -----------------------------------------------------

function SharePanel({ agentId, embed, onClose }: { agentId: string; embed: boolean; onClose: () => void }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/embed/${agentId}`;
  const iframe = `<iframe src="${url}" width="420" height="640" style="border:0;border-radius:16px" allow="microphone"></iframe>`;
  return (
    <PanelShell
      title={embed ? "Embed" : "Share"}
      subtitle={embed
        ? "Embed this agent as a widget on your website"
        : "Share a direct link so anyone can talk to this agent"}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div>
          <label className="label">{embed ? "Embed code" : "Share link"}</label>
          <textarea readOnly rows={embed ? 4 : 2} className="field font-mono !text-[12px]"
            value={embed ? iframe : url} onClick={(e) => (e.target as HTMLTextAreaElement).select()} />
        </div>
        <button
          onClick={() => { navigator.clipboard.writeText(embed ? iframe : url); toast("Copied to clipboard."); }}
          className="btn-primary flex items-center gap-1.5">
          <Copy className="h-4 w-4" /> Copy {embed ? "embed code" : "link"}
        </button>
        <p className="flex items-start gap-2 rounded-xl border border-ink-800 bg-ink-800/40 px-4 py-3 text-sm text-ink-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          The agent must be set to public in the editor&apos;s Share settings for the link to work for visitors.
        </p>
      </div>
    </PanelShell>
  );
}

// --- Generate flow modal -----------------------------------------------------

function GenerateFlowModal({
  onClose,
  onGenerated,
}: {
  onClose: () => void;
  onGenerated: (flow: ConversationFlow) => void;
}) {
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/ai/generate-flow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && data.flow) onGenerated(data.flow);
    else setError(data.error ?? "Could not generate a flow.");
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-xl rounded-2xl border border-ink-700 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Sparkles className="h-4 w-4 text-[#301C3F]" /> Generate Flow with AI
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-1 text-sm text-ink-400">
          Describe the business and what the call should accomplish — the AI drafts the full conversation flow.
          This replaces the current flow.
        </p>
        <textarea autoFocus rows={5} className="field mt-4"
          placeholder="e.g. A dental clinic receptionist that greets callers, checks if they are new or existing patients, books appointments, and transfers emergencies to +971501234567..."
          value={brief} onChange={(e) => setBrief(e.target.value)} />
        {error && <p className="mt-2 text-sm text-signal-red">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={generate} disabled={busy || !brief.trim()} className="btn-primary disabled:opacity-50">
            {busy ? "Generating…" : "Generate Flow"}
          </button>
        </div>
      </div>
    </div>
  );
}
