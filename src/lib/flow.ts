// Conversation Flow model for the visual Flow Designer, plus the compiler
// that turns a flow into a working agent (system prompt, greeting, tools,
// knowledge bases, extraction outcomes) so flows run on real calls.

import { AgentTool, AgentOutcome } from "./agent-defaults";

export type FlowNodeType = "start" | "prompt" | "webhook" | "transfer" | "end";

export interface FlowExtractVar {
  name: string;
  type: string; // String | Number | Boolean
  description?: string;
  possibleValues?: string[];
}

export interface FlowNodeData {
  // start
  openingMessage?: string;
  goal?: string; // conversation goal (start + prompt)
  // prompt
  kbIds?: string[];
  includeGlobalTools?: boolean;
  tools?: AgentTool[];
  extract?: FlowExtractVar[];
  // webhook
  method?: "GET" | "POST" | "PUT";
  url?: string;
  headers?: string; // JSON text
  body?: string; // JSON text
  // transfer
  transferType?: "sip" | "number";
  destination?: string;
  message?: string; // AI message before transfer
  // end
  closingMessage?: string;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  label: string;
  x: number;
  y: number;
  data: FlowNodeData;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  transitionType: "nl" | "always"; // forward path
  condition?: string; // natural-language condition
  backTransitionType?: "nl" | "always";
  backCondition?: string;
}

export interface ConversationFlow {
  nodes: FlowNode[];
  edges: FlowEdge[];
  globalTools: AgentTool[];
}

export const PREDEFINED_FLOW_VARS: { name: string; description: string }[] = [
  { name: "now", description: "Current date and time" },
  { name: "date", description: "Current date (YYYY-MM-DD)" },
  { name: "time", description: "Current time (HH:MM:SS)" },
  { name: "month", description: "Current month name" },
  { name: "day", description: "Current day of week" },
  { name: "year", description: "Current year" },
  { name: "call_from_number", description: "Caller phone number" },
  { name: "call_to_number", description: "Called phone number" },
  { name: "sip_headers", description: "SIP headers from call" },
];

export function newFlowId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultFlow(): ConversationFlow {
  return {
    nodes: [
      {
        id: newFlowId("node"),
        type: "start",
        label: "Start Call",
        x: 520,
        y: 120,
        data: { openingMessage: "", goal: "" },
      },
    ],
    edges: [],
    globalTools: [
      {
        id: newFlowId("tool"),
        type: "end_call",
        title: "End Call",
        name: "end_call",
        description: "Allows the AI agent to end the current call",
        aiResponse: "Thank you for calling. Goodbye!",
      } as AgentTool,
    ],
  };
}

// --- Sanitizer ---------------------------------------------------------------

function str(v: unknown, max = 4000): string {
  return String(v ?? "").slice(0, max);
}

export function sanitizeFlow(input: unknown): ConversationFlow | null {
  if (!input || typeof input !== "object") return null;
  const src = input as ConversationFlow;
  if (!Array.isArray(src.nodes)) return null;

  const nodes: FlowNode[] = src.nodes
    .filter((n) => n && typeof n === "object")
    .slice(0, 60)
    .map((n) => ({
      id: str(n.id, 40) || newFlowId("node"),
      type: (["start", "prompt", "webhook", "transfer", "end"] as const).includes(n.type)
        ? n.type
        : "prompt",
      label: str(n.label, 80) || "Node",
      x: Math.max(-5000, Math.min(10000, Number(n.x) || 0)),
      y: Math.max(-5000, Math.min(10000, Number(n.y) || 0)),
      data: {
        openingMessage: str(n.data?.openingMessage, 1000),
        goal: str(n.data?.goal, 4000),
        kbIds: Array.isArray(n.data?.kbIds) ? n.data.kbIds.map((k) => str(k, 40)).slice(0, 10) : [],
        includeGlobalTools: n.data?.includeGlobalTools !== false,
        tools: Array.isArray(n.data?.tools) ? (n.data.tools as AgentTool[]).slice(0, 10) : [],
        extract: Array.isArray(n.data?.extract)
          ? n.data.extract
              .filter((v) => v && typeof v === "object")
              .map((v) => ({
                name: str(v.name, 60).replace(/[^\w.-]/g, "_"),
                type: ["String", "Number", "Boolean"].includes(String(v.type)) ? String(v.type) : "String",
                description: str(v.description, 200),
                possibleValues: Array.isArray(v.possibleValues)
                  ? v.possibleValues.map((p) => str(p, 80)).slice(0, 20)
                  : [],
              }))
              .filter((v) => v.name)
              .slice(0, 15)
          : [],
        method: (["GET", "POST", "PUT"] as const).includes(n.data?.method as "GET") ? n.data!.method : "POST",
        url: str(n.data?.url, 800),
        headers: str(n.data?.headers, 2000),
        body: str(n.data?.body, 4000),
        transferType: n.data?.transferType === "number" ? "number" : "sip",
        destination: str(n.data?.destination, 200),
        message: str(n.data?.message, 500),
        closingMessage: str(n.data?.closingMessage, 500),
      },
    }));

  const ids = new Set(nodes.map((n) => n.id));
  const edges: FlowEdge[] = Array.isArray(src.edges)
    ? src.edges
        .filter((e) => e && typeof e === "object" && ids.has(String(e.from)) && ids.has(String(e.to)))
        .slice(0, 120)
        .map((e) => ({
          id: str(e.id, 40) || newFlowId("edge"),
          from: str(e.from, 40),
          to: str(e.to, 40),
          label: str(e.label, 120),
          transitionType: e.transitionType === "always" ? "always" : "nl",
          condition: str(e.condition, 500),
          backTransitionType: e.backTransitionType === "nl" ? "nl" : "always",
          backCondition: str(e.backCondition, 500),
        }))
    : [];

  const globalTools = Array.isArray(src.globalTools) ? (src.globalTools as AgentTool[]).slice(0, 15) : [];

  return { nodes, edges, globalTools };
}

// --- Validation --------------------------------------------------------------

export interface FlowIssue {
  kind: "error" | "warning";
  nodeId?: string;
  message: string;
}

export function validateFlow(flow: ConversationFlow): FlowIssue[] {
  const issues: FlowIssue[] = [];
  const start = flow.nodes.find((n) => n.type === "start");
  if (!start) {
    issues.push({ kind: "error", message: "The flow needs a Start Call node." });
  } else if (!start.data.openingMessage?.trim()) {
    issues.push({ kind: "error", nodeId: start.id, message: `"${start.label}": the start message is empty.` });
  }
  for (const n of flow.nodes) {
    if (n.type === "webhook" && !/^https?:\/\/.+/.test(n.data.url ?? "")) {
      issues.push({ kind: "error", nodeId: n.id, message: `"${n.label}": the webhook is not configured.` });
    }
    if (n.type === "transfer" && !n.data.destination?.trim()) {
      issues.push({ kind: "error", nodeId: n.id, message: `"${n.label}": the transfer destination is empty.` });
    }
    if (n.type === "prompt" && !n.data.goal?.trim()) {
      issues.push({ kind: "warning", nodeId: n.id, message: `"${n.label}": no instructions for the agent yet.` });
    }
    if (n.type === "end" && !n.data.closingMessage?.trim()) {
      issues.push({ kind: "warning", nodeId: n.id, message: `"${n.label}": no closing message set.` });
    }
  }
  // Unreachable nodes (not connected from the start node).
  if (start) {
    const reachable = new Set<string>([start.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const e of flow.edges) {
        if (reachable.has(e.from) && !reachable.has(e.to)) {
          reachable.add(e.to);
          grew = true;
        }
      }
    }
    for (const n of flow.nodes) {
      if (!reachable.has(n.id)) {
        issues.push({ kind: "warning", nodeId: n.id, message: `"${n.label}" is not connected to the flow.` });
      }
    }
  }
  for (const e of flow.edges) {
    if (e.transitionType === "nl" && !e.condition?.trim() && !e.label?.trim()) {
      issues.push({ kind: "warning", message: "An edge has no condition or label — it will be treated as always-follow." });
    }
  }
  return issues;
}

// --- Compiler ----------------------------------------------------------------
// Turns the flow into the same primitives single-prompt agents use, so the
// existing Vapi sync, test panel, and post-call extraction all work unchanged.

function slug(label: string, fallback: string) {
  const s = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  return s || fallback;
}

export interface CompiledFlow {
  systemPrompt: string;
  greeting: string;
  tools: AgentTool[];
  knowledgeBaseIds: string[];
  outcomes: AgentOutcome[];
}

export function compileFlow(flow: ConversationFlow, agentName: string): CompiledFlow {
  const nodesById = new Map(flow.nodes.map((n) => [n.id, n]));
  const start = flow.nodes.find((n) => n.type === "start");
  const greeting = start?.data.openingMessage?.trim() || "";

  const tools: AgentTool[] = [];
  const seenToolNames = new Set<string>();
  function addTool(t: AgentTool) {
    if (seenToolNames.has(t.name)) return;
    seenToolNames.add(t.name);
    tools.push(t);
  }
  for (const t of flow.globalTools) addTool(t);

  const kbIds = new Set<string>();
  const outcomes: AgentOutcome[] = [];
  const seenOutcomes = new Set<string>();

  const lines: string[] = [];
  lines.push(`# CONVERSATION FLOW`);
  lines.push(
    `You are ${agentName || "an AI voice agent"}. Follow this conversation flow strictly, step by step. ` +
      `Stay on the current step until one of its transition conditions is met, then move to the target step. ` +
      `Never invent steps that are not in the flow.`
  );

  // Order nodes: BFS from the start node so the prompt reads in flow order.
  const order: FlowNode[] = [];
  const visited = new Set<string>();
  const queue: FlowNode[] = start ? [start] : [...flow.nodes];
  while (queue.length) {
    const n = queue.shift()!;
    if (visited.has(n.id)) continue;
    visited.add(n.id);
    order.push(n);
    for (const e of flow.edges.filter((e) => e.from === n.id)) {
      const t = nodesById.get(e.to);
      if (t && !visited.has(t.id)) queue.push(t);
    }
  }
  for (const n of flow.nodes) if (!visited.has(n.id)) order.push(n);

  for (const n of order) {
    lines.push("");
    lines.push(`## STEP: ${n.label} (${n.type === "start" ? "start of call" : n.type})`);
    if (n.type === "start") {
      if (n.data.openingMessage?.trim()) {
        lines.push(`Open the call by saying: "${n.data.openingMessage.trim()}"`);
      }
      if (n.data.goal?.trim()) lines.push(`Conversation goal: ${n.data.goal.trim()}`);
    }
    if (n.type === "prompt") {
      if (n.data.goal?.trim()) lines.push(n.data.goal.trim());
      for (const id of n.data.kbIds ?? []) kbIds.add(id);
      for (const t of n.data.tools ?? []) addTool(t);
      for (const v of n.data.extract ?? []) {
        if (seenOutcomes.has(v.name)) continue;
        seenOutcomes.add(v.name);
        outcomes.push({
          name: v.name,
          description: v.description || `Extracted at step "${n.label}"`,
          possibleValues: v.possibleValues ?? [],
        });
        lines.push(
          `During this step, capture the variable {{${v.name}}} (${v.type})${
            v.possibleValues?.length ? ` — one of: ${v.possibleValues.join(", ")}` : ""
          }.`
        );
      }
    }
    if (n.type === "webhook") {
      const name = slug(n.label, "webhook_step");
      addTool({
        id: n.id,
        type: "live_webhook",
        title: n.label,
        name,
        description: `Webhook for flow step "${n.label}"`,
        aiResponse: "One moment while I check that for you.",
        config: {
          method: n.data.method ?? "POST",
          url: n.data.url ?? "",
          headers: n.data.headers ?? "",
          body: n.data.body ?? "",
        },
      } as AgentTool);
      lines.push(`When you reach this step, call the tool \`${name}\` and use its response to continue.`);
    }
    if (n.type === "transfer") {
      const isNumber = n.data.transferType === "number";
      addTool({
        id: n.id,
        type: "transfer_call",
        title: n.label,
        name: slug(n.label, "transfer_call"),
        description: `Transfer for flow step "${n.label}"`,
        aiResponse: n.data.message || "Please hold while I transfer you.",
        config: isNumber ? { phoneNumber: n.data.destination ?? "" } : { sip: n.data.destination ?? "" },
      } as AgentTool);
      if (n.data.message?.trim()) lines.push(`Before transferring, say: "${n.data.message.trim()}"`);
      lines.push(
        `Then transfer the call to ${isNumber ? `the phone number ${n.data.destination}` : `the SIP destination ${n.data.destination}`}.`
      );
    }
    if (n.type === "end") {
      if (n.data.closingMessage?.trim()) {
        lines.push(`Say the closing message: "${n.data.closingMessage.trim()}"`);
      }
      lines.push(`Then end the call.`);
      addTool({
        id: n.id,
        type: "end_call",
        title: "End Call",
        name: "end_call",
        description: "Allows the AI agent to end the current call",
        aiResponse: n.data.closingMessage || "Goodbye!",
      } as AgentTool);
    }

    const out = flow.edges.filter((e) => e.from === n.id);
    if (out.length > 0) {
      lines.push(`Transitions from this step:`);
      for (const e of out) {
        const target = nodesById.get(e.to);
        if (!target) continue;
        const cond =
          e.transitionType === "always" || !(e.condition?.trim() || e.label?.trim())
            ? "always, once this step is complete"
            : e.condition?.trim() || e.label?.trim();
        lines.push(`- Go to "${target.label}" when: ${cond}`);
        if (e.backTransitionType === "nl" && e.backCondition?.trim()) {
          lines.push(`- Return to "${n.label}" from "${target.label}" when: ${e.backCondition.trim()}`);
        }
      }
    } else if (n.type !== "end") {
      lines.push(`This step has no outgoing transitions — wrap up naturally or end the call politely.`);
    }
  }

  return {
    systemPrompt: lines.join("\n"),
    greeting,
    tools,
    knowledgeBaseIds: [...kbIds],
    outcomes,
  };
}

// Custom {{variables}} referenced anywhere in the flow (excluding predefined).
export function detectCustomVars(flow: ConversationFlow): string[] {
  const predefined = new Set(PREDEFINED_FLOW_VARS.map((v) => v.name));
  const found = new Set<string>();
  const texts: string[] = [];
  for (const n of flow.nodes) {
    texts.push(n.data.openingMessage ?? "", n.data.goal ?? "", n.data.url ?? "", n.data.headers ?? "", n.data.body ?? "", n.data.message ?? "", n.data.closingMessage ?? "");
    for (const v of n.data.extract ?? []) found.add(v.name);
  }
  for (const t of texts) {
    for (const m of t.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) {
      if (!predefined.has(m[1])) found.add(m[1]);
    }
  }
  return [...found];
}
