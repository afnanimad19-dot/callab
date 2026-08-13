// Data layer with two interchangeable backends:
//
//  - FileStore     — zero-config JSON file, used automatically in local dev.
//  - SupabaseStore — used automatically when SUPABASE_URL and
//                    SUPABASE_SERVICE_ROLE_KEY are set (i.e. on Netlify).
//
// Supabase tables use a simple document shape (id, user_id, data jsonb) —
// see supabase/schema.sql. All reads/writes go through this module only.

import fs from "fs";
import path from "path";

// Billing lives on the workspace owner's user record — no extra table needed.
// Card data stores ONLY display metadata (last4, expiry, holder, address);
// full card numbers never touch our backend. Real charging arrives with the
// Stripe integration; purchases meanwhile update balances + history.
export interface BillingCard {
  id: string;
  holder: string;
  last4: string;
  expMonth: string;
  expYear: string;
  address: string;
  city: string;
  country: string;
  taxNumber?: string;
  isDefault: boolean;
}

export interface BillingEntry {
  id: string;
  description: string;
  detail: string;
  date: string; // ISO
  amount: number; // USD
  status: "Paid";
}

export interface BillingState {
  planName: string;
  planPrice: number; // USD / month
  planMinutes: number;
  startedAt: string; // ISO
  minutesTotal: number;
  minutesUsed: number;
  addons: { workspace: number; knowledgeBase: number };
  cards: BillingCard[];
  history: BillingEntry[];
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  company: string;
  name: string;
  createdAt: string;
  apiKey?: string;
  // Clinic contact details, shown in the patient's confirmation email.
  clinicAddress?: string;
  clinicPhone?: string;
  clinicMapUrl?: string; // Google Maps / location link
  // Team members: ownerId points at the workspace owner's user id.
  ownerId?: string;
  role?: "owner" | "supervisor" | "viewer";
  status?: "active" | "invited" | "blocked";
  verifyToken?: string;
  emailVerified?: boolean;
  mustResetPassword?: boolean;
  billing?: BillingState;
  // Two INDEPENDENT Google connections — Calendar and Sheets can each be linked
  // to a different Google account. Each workspace owner connects their own
  // account(s); refresh tokens live with their tenant data. (Customer emails
  // are sent via Resend, not Google.)
  googleServices?: {
    calendar?: GoogleConn;
    sheets?: GoogleConn & {
      spreadsheetId?: string; // the sheet leads/appointments are logged into
      spreadsheetName?: string;
      sheetTab?: string; // which tab within that spreadsheet
      columns?: string[]; // the tab's header row (row 1), cached for mapping
      mapping?: Record<string, string>; // our field key -> the column header it writes into
    };
  };
  // Legacy single-connection fields (pre-split). Read once and migrated into
  // googleServices, then cleared. Kept in the type so old records still parse.
  googleRefreshToken?: string;
  googleEmail?: string;
  googleSheetId?: string;
}

export interface GoogleConn {
  refreshToken: string;
  email?: string;
}

import type { AgentAdvanced, AgentOutcome, AgentTool } from "./agent-defaults";
export { DEFAULT_ADVANCED, DEFAULT_TOOLS } from "./agent-defaults";
export type { AgentAdvanced, AgentOutcome, AgentTool } from "./agent-defaults";

// Snapshot of the editable fields, kept per save so the editor can show a
// revision history and restore any previous version.
export interface AgentRevision {
  version: number;
  savedAt: string;
  snapshot: Record<string, unknown>;
}

export interface Agent {
  id: string;
  userId: string;
  name: string;
  role: string;
  voice: string;
  language: string;
  greeting: string; // opening message
  systemPrompt: string; // compiled identity + tasks + guardrails (Vapi sync)
  phoneNumber: string;
  status: "active" | "paused" | "draft";
  vapiAssistantId?: string;
  createdAt: string;
  // Editor fields (optional so older rows stay valid)
  agentType?: "single_prompt" | "conversation_flow";
  flow?: import("./flow").ConversationFlow; // visual Flow Designer graph
  version?: number;
  backgroundAudio?: string;
  identity?: string;
  tasks?: string;
  guardrails?: string;
  whoSpeaksFirst?: "agent" | "caller";
  outcomes?: AgentOutcome[];
  advanced?: AgentAdvanced;
  tools?: AgentTool[];
  visibility?: "private" | "public"; // public = embeddable web-call widget
  revisions?: AgentRevision[]; // most recent first, capped
  voiceId?: string; // ElevenLabs voice id (overrides the named VOICE_MAP)
  knowledgeBaseIds?: string[]; // attached Knowledge Base resources
  // Voice engine (see lib/voice-presets). speedPreset is the one-click bundle;
  // the individual fields override it when set.
  speedPreset?: import("./voice-presets").SpeedPreset;
  llmModel?: string; // "provider:model", e.g. "openai:gpt-4o"
  voiceModel?: string; // ElevenLabs model, e.g. "eleven_turbo_v2_5"
  transcriberModel?: string; // Deepgram model, e.g. "nova-2"
}

export interface TranscriptTurn {
  speaker: "agent" | "caller" | "supervisor";
  text: string;
  at: number;
}

export interface Call {
  id: string;
  userId: string;
  agentId: string;
  agentName: string;
  callerNumber: string;
  direction: "inbound" | "outbound";
  startedAt: string;
  durationSec: number;
  outcome: "resolved" | "escalated" | "voicemail" | "callback_scheduled";
  endReason: string;
  sentiment: "positive" | "neutral" | "negative";
  confidence: number;
  summary: string;
  campaignId?: string;
  transcript: TranscriptTurn[];
  isTest?: boolean; // logged from the Test Agent panel
  recordingUrl?: string; // audio recording (from the voice pipeline)
  vapiCallId?: string; // Vapi call id — used to fetch the recording lazily
}

export interface CampaignSchedule {
  startDate: string; // YYYY-MM-DD
  endDate: string; // empty = ongoing
  from: string; // HH:MM
  to: string; // HH:MM
  days: string[]; // ["Mon", ...]
  timezone: string;
  retryAttempts: boolean;
}

export interface Campaign {
  id: string;
  userId: string;
  name: string;
  agentId: string;
  agentName: string;
  goal: string; // description
  status:
    | "draft"
    | "scheduled"
    | "running"
    | "paused"
    | "stopped"
    | "completed"
    | "archived";
  contactsTotal: number;
  contactsCalled: number;
  createdAt: string;
  // Wizard fields (optional so older rows stay valid)
  direction?: "inbound" | "outbound";
  phoneNumber?: string;
  schedule?: CampaignSchedule;
  filters?: { sources: string[]; tags: string[]; categories: string[] };
  variableMapping?: Record<string, string>;
  webhookId?: string;
  syncWithContact?: boolean;
  updatedAt?: string;
  vapiCampaignId?: string; // native Vapi campaign id when launched via Vapi
}

export interface Contact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  tag: string;
  createdAt: string;
  source?: string; // "Manual" | "Import" | integration name
  category?: string;
  metadata?: Record<string, string>;
}

export interface PhoneNumber {
  id: string;
  userId: string;
  number: string;
  provider: string;
  agentName: string;
  status: "active" | "unassigned";
  createdAt: string;
  nickname?: string;
  numberType?: "national" | "local" | "toll-free";
  scope?: string; // e.g. "Global"
  vapiPhoneNumberId?: string;
  updatedAt?: string;
}

export interface WebhookStep {
  name: string;
  method: "POST" | "GET" | "PUT";
  url: string;
}

export interface WebhookVariable {
  name: string;
  jsonPath: string;
  sourceType: "response" | "static";
  sourceStep?: string;
  dataType: "string" | "number" | "boolean";
  value?: string;
}

export interface Webhook {
  id: string;
  userId: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
  name?: string;
  steps?: WebhookStep[];
  variables?: WebhookVariable[];
  predefinedVariables?: Record<string, string>;
}

export interface IntegrationFlowStep {
  id: string;
  method: "GET" | "POST";
  url: string;
  headers: Record<string, string>;
  timeoutSec: number;
  retryLimit: number;
  totalTimeoutSec: number;
  dependsOn?: string; // id of the step that must succeed first
  successKey?: string; // optional success condition: response[key] == value
  successValue?: string;
}

export interface IntegrationVariable {
  name: string;
  jsonPath: string;
  sourceType: "response" | "custom";
  sourceStep?: string;
  dataType: string;
  customValue?: string;
}

export interface IntegrationRun {
  at: string;
  status: "success" | "failed";
  message: string;
}

export interface Integration {
  id: string;
  userId: string;
  name: string;
  tag: string;
  category: string;
  intervalSeconds: number;
  steps: WebhookStep[]; // legacy simple steps (kept for old rows)
  status: "idle" | "running" | "failed" | "success" | "stopped";
  lastRunAt?: string;
  createdAt: string;
  // Full custom-integration config (3-step wizard)
  retryUnit?: "Seconds" | "Minutes" | "Hours";
  maxRetries?: number;
  predefinedVariables?: Record<string, string>;
  flowSteps?: IntegrationFlowStep[];
  variables?: IntegrationVariable[];
  mapping?: Record<string, string>; // standard field -> result path
  runs?: IntegrationRun[]; // newest first, capped
}

// Appointments created by agents during calls/chats (and manually), shown on
// the Calendar tab and optionally synced to the customer's Google Calendar.
export interface Appointment {
  id: string;
  userId: string;
  patientName: string;
  phone?: string;
  email?: string;
  doctor?: string;
  service?: string;
  status: "booked" | "rescheduled" | "canceled" | "completed";
  startsAt: string; // ISO datetime
  endsAt?: string;
  notes?: string;
  contactId?: string;
  source?: string; // "call" | "chat" | "manual"
  gcalEventId?: string;
  createdAt: string;
  updatedAt: string;
}

// Omnichannel: one conversation per customer per channel.
export interface Conversation {
  id: string;
  userId: string;
  channel: "whatsapp" | "instagram" | "messenger";
  externalId: string; // wa_id / IG user id / PSID
  customerName: string;
  customerPhone?: string;
  contactId?: string;
  aiEnabled: boolean; // false = assigned to a human
  agentId?: string; // per-conversation agent override (Agent Hub default otherwise)
  assignee?: string; // human display name when taken over
  lifecycle?: string; // pipeline stage key: new_lead | hot_lead | payment | customer
  lastMessageAt: string;
  lastMessageText?: string;
  unread: number;
  createdAt: string;
  // Chat session handling (text channels only): when the last chat went quiet
  // past the timeout, the next message shows a resume menu.
  awaitingSessionChoice?: boolean;
  sessionStartAt?: string; // messages before this are excluded after a "new chat"
  vapiChatId?: string; // thread id so the assistant keeps context between messages
  lastReplyError?: string; // why the last AI reply failed (debug)
}

export interface ChatMessage {
  id: string;
  userId: string;
  conversationId: string;
  direction: "in" | "out";
  from: "customer" | "agent" | "human";
  kind: "text" | "audio";
  text: string;
  mediaUrl?: string;
  at: string; // ISO
  externalMsgId?: string; // provider message id, for de-duplicating retries
}

// Per-workspace channel connections + Agent Hub settings. Meta tokens are the
// CUSTOMER's own credentials for their pages/numbers (per-tenant, so they
// live with the tenant's data — unlike our provider keys, which stay in env).
export interface ChannelSettings {
  id: string; // one row per user: `ch_<userId>`
  userId: string;
  defaultChatAgentId?: string; // Agent Hub default agent
  aiAutoReply: boolean; // master toggle
  whatsapp?: {
    phoneNumberId: string;
    accessToken: string;
    connected: boolean;
    displayNumber?: string; // the actual +xxx number, for display
    wabaId?: string; // WhatsApp Business Account ID
    pin?: string; // two-step verification PIN (needed to register the number)
  };
  instagram?: { pageId: string; accessToken: string; connected: boolean };
  messenger?: { pageId: string; accessToken: string; connected: boolean };
  updatedAt: string;
  // Debug: when Meta last called our webhook for this workspace, and a summary.
  lastWebhookAt?: string;
  lastWebhookInfo?: string;
}

export interface KnowledgeBase {
  id: string;
  userId: string;
  name: string;
  description: string;
  docsCount: number;
  createdAt: string;
  type?: "file" | "url" | "text" | "gdoc";
  url?: string;
  content?: string; // for text resources; also used by the KB test chat
  fileName?: string; // original filename for uploaded files (download keeps it)
  autoUpdate?: boolean;
  crawl?: boolean;
  multipleUrls?: boolean;
  updatedAt?: string;
}

interface Database {
  users: User[];
  agents: Agent[];
  calls: Call[];
  campaigns: Campaign[];
  contacts: Contact[];
  phoneNumbers: PhoneNumber[];
  webhooks: Webhook[];
  knowledgeBases: KnowledgeBase[];
  integrations: Integration[];
  appointments: Appointment[];
  conversations: Conversation[];
  chatMessages: ChatMessage[];
  channels: ChannelSettings[];
}

type Table = keyof Database;
type Row = Database[Table][number];

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

// ---------------------------------------------------------------------------
// Backend interface
// ---------------------------------------------------------------------------

interface Store {
  list<T extends Row>(table: Table, userId?: string): Promise<T[]>;
  insert<T extends Row>(table: Table, row: T): Promise<T>;
  insertMany<T extends Row>(table: Table, rows: T[]): Promise<T[]>;
  update<T extends Row>(table: Table, id: string, patch: Partial<T>): Promise<T | undefined>;
  remove(table: Table, id: string): Promise<boolean>;
}

/** Which backend is active, for diagnostics (see /api/health). */
export const storeMode: "supabase" | "file" =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? "supabase"
    : "file";

// --- FileStore (local dev) --------------------------------------------------

const DB_FILE = path.join(process.cwd(), "data", "db.json");

const EMPTY: Database = {
  users: [],
  agents: [],
  calls: [],
  campaigns: [],
  contacts: [],
  phoneNumbers: [],
  webhooks: [],
  knowledgeBases: [],
  integrations: [],
  appointments: [],
  conversations: [],
  chatMessages: [],
  channels: [],
};

function readFileDb(): Database {
  try {
    return { ...EMPTY, ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) };
  } catch {
    return { ...EMPTY };
  }
}

function writeFileDb(db: Database) {
  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (e: unknown) {
    // On serverless hosts (Netlify/Vercel) the filesystem is read-only, so
    // file storage cannot persist. Surface a clear, actionable message
    // instead of an opaque crash — the fix is always to configure Supabase.
    const code = (e as { code?: string }).code;
    if (code === "EROFS" || code === "EACCES") {
      throw new Error(
        "Persistent storage is not configured. Set SUPABASE_URL and " +
          "SUPABASE_SERVICE_ROLE_KEY environment variables (see README)."
      );
    }
    throw e;
  }
}

const fileStore: Store = {
  async list(table, userId) {
    const rows = readFileDb()[table] as Row[];
    return (userId
      ? rows.filter((r) => "userId" in r && r.userId === userId)
      : rows) as never;
  },
  async insert(table, row) {
    const db = readFileDb();
    (db[table] as Row[]).push(row);
    writeFileDb(db);
    return row;
  },
  async insertMany(table, rows) {
    const db = readFileDb();
    (db[table] as Row[]).push(...rows);
    writeFileDb(db);
    return rows;
  },
  async update(table, id, patch) {
    const db = readFileDb();
    const row = (db[table] as Row[]).find((r) => r.id === id);
    if (!row) return undefined;
    Object.assign(row, patch, { id: row.id });
    writeFileDb(db);
    return row as never;
  },
  async remove(table, id) {
    const db = readFileDb();
    const rows = db[table] as Row[];
    const next = rows.filter((r) => r.id !== id);
    (db[table] as Row[]) = next as never;
    writeFileDb(db);
    return next.length < rows.length;
  },
};

// --- SupabaseStore (production) ---------------------------------------------
// Talks to Supabase's PostgREST API directly; tables store the row as jsonb.

const TABLE_NAMES: Record<Table, string> = {
  users: "users",
  agents: "agents",
  calls: "calls",
  campaigns: "campaigns",
  contacts: "contacts",
  phoneNumbers: "phone_numbers",
  webhooks: "webhooks",
  knowledgeBases: "knowledge_bases",
  integrations: "integrations",
  appointments: "appointments",
  conversations: "conversations",
  chatMessages: "chat_messages",
  channels: "channels",
};

function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function rest(pathAndQuery: string, init?: RequestInit) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/${pathAndQuery}`,
    { ...init, headers: { ...supabaseHeaders(), ...init?.headers } }
  );
  if (!res.ok) {
    const text = await res.text();
    // 42501 = row-level security violation. The service_role key bypasses
    // RLS, so hitting this means the anon/publishable key was configured
    // by mistake. Say so explicitly — it's the #1 setup error.
    const hint = text.includes("42501")
      ? " — SUPABASE_SERVICE_ROLE_KEY appears to be the anon/publishable key. Use the service_role (secret) key from Supabase → Project Settings → API keys."
      : text.includes("42P01") || text.includes("PGRST205") || text.includes("Could not find the table")
        ? " — this table doesn't exist yet. Run the latest supabase/schema.sql in the Supabase SQL editor."
        : "";
    throw new Error(`Supabase ${res.status}: ${text}${hint}`);
  }
  return res;
}

const supabaseStore: Store = {
  async list(table, userId) {
    const t = TABLE_NAMES[table];
    const filter = userId ? `&user_id=eq.${encodeURIComponent(userId)}` : "";
    let res: Response;
    try {
      res = await rest(`${t}?select=data${filter}`);
    } catch (e) {
      // A table added by a newer schema.sql that hasn't been run yet must not
      // crash whole pages — read as empty and surface the fix in the logs.
      if ((e as Error).message.includes("doesn't exist yet")) {
        console.error(`Supabase table "${t}" missing:`, (e as Error).message);
        return [] as never;
      }
      throw e;
    }
    const rows = (await res.json()) as { data: Row }[];
    return rows.map((r) => r.data) as never;
  },
  async insert(table, row) {
    const t = TABLE_NAMES[table];
    await rest(t, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        id: row.id,
        user_id: "userId" in row ? row.userId : null,
        data: row,
      }),
    });
    return row;
  },
  async insertMany(table, rows) {
    if (rows.length === 0) return rows;
    const t = TABLE_NAMES[table];
    // One request inserts the whole array — avoids dozens of round-trips.
    await rest(t, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(
        rows.map((row) => ({
          id: row.id,
          user_id: "userId" in row ? row.userId : null,
          data: row,
        }))
      ),
    });
    return rows;
  },
  async update(table, id, patch) {
    const t = TABLE_NAMES[table];
    const res = await rest(`${t}?id=eq.${encodeURIComponent(id)}&select=data`);
    const rows = (await res.json()) as { data: Row }[];
    if (!rows.length) return undefined;
    const merged = { ...rows[0].data, ...patch, id };
    await rest(`${t}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ data: merged }),
    });
    return merged as never;
  },
  async remove(table, id) {
    const t = TABLE_NAMES[table];
    await rest(`${t}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    return true;
  },
};

const store: Store =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? supabaseStore
    : fileStore;

// ---------------------------------------------------------------------------
// Typed helpers used by routes and pages
// ---------------------------------------------------------------------------

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const users = await store.list<User>("users");
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export const createUser = (u: User) => store.insert("users", u);
export const updateUser = (id: string, patch: Partial<User>) =>
  store.update<User>("users", id, patch);
export async function findUserById(id: string): Promise<User | undefined> {
  return (await store.list<User>("users")).find((u) => u.id === id);
}
// Owner + everyone invited into the owner's workspace.
export async function listWorkspaceMembers(ownerId: string): Promise<User[]> {
  const all = await store.list<User>("users");
  return all.filter((u) => u.id === ownerId || u.ownerId === ownerId);
}
export async function findUserByVerifyToken(token: string): Promise<User | undefined> {
  return (await store.list<User>("users")).find((u) => u.verifyToken === token);
}

export async function listAgents(userId: string): Promise<Agent[]> {
  // Newest first — a freshly created agent appears at the top of the list.
  const agents = await store.list<Agent>("agents", userId);
  return agents.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function findAgent(userId: string, id: string) {
  return (await listAgents(userId)).find((a) => a.id === id);
}
export const createAgent = (a: Agent) => store.insert("agents", a);
export const insertAgents = (rows: Agent[]) => store.insertMany("agents", rows);
// Used by the Vapi webhook to route an incoming call to the right workspace,
// since the webhook only knows the Vapi assistant id (across all users).
// Cross-workspace lookup used ONLY by the public embed endpoint, which
// checks agent.visibility === "public" before returning anything.
export async function findAgentAnyUser(id: string): Promise<Agent | undefined> {
  return (await store.list<Agent>("agents")).find((a) => a.id === id);
}
export async function findAgentByVapiAssistantId(
  assistantId: string
): Promise<Agent | undefined> {
  const all = await store.list<Agent>("agents");
  return all.find((a) => a.vapiAssistantId === assistantId);
}
export async function updateAgent(userId: string, id: string, patch: Partial<Agent>) {
  if (!(await findAgent(userId, id))) return undefined;
  return store.update<Agent>("agents", id, patch);
}
export async function deleteAgent(userId: string, id: string) {
  if (!(await findAgent(userId, id))) return false;
  return store.remove("agents", id);
}

export async function listCalls(userId: string): Promise<Call[]> {
  const calls = await store.list<Call>("calls", userId);
  return calls.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
export async function findCall(userId: string, id: string) {
  return (await store.list<Call>("calls", userId)).find((c) => c.id === id);
}
export const insertCalls = (calls: Call[]) => store.insertMany("calls", calls);
export const deleteCall = (id: string) => store.remove("calls", id);
export async function updateCall(userId: string, id: string, patch: Partial<Call>) {
  if (!(await findCall(userId, id))) return undefined;
  return store.update<Call>("calls", id, patch);
}

export const listCampaigns = (userId: string) => store.list<Campaign>("campaigns", userId);
export const createCampaign = (c: Campaign) => store.insert("campaigns", c);
export const insertCampaigns = (rows: Campaign[]) => store.insertMany("campaigns", rows);
export const deleteCampaign = (id: string) => store.remove("campaigns", id);
export async function updateCampaign(userId: string, id: string, patch: Partial<Campaign>) {
  const exists = (await listCampaigns(userId)).some((c) => c.id === id);
  if (!exists) return undefined;
  return store.update<Campaign>("campaigns", id, patch);
}

export const listContacts = (userId: string) => store.list<Contact>("contacts", userId);
export const createContact = (c: Contact) => store.insert("contacts", c);
export const insertContacts = (rows: Contact[]) => store.insertMany("contacts", rows);
export const deleteContact = (id: string) => store.remove("contacts", id);
export async function updateContact(userId: string, id: string, patch: Partial<Contact>) {
  const exists = (await listContacts(userId)).some((c) => c.id === id);
  if (!exists) return undefined;
  return store.update<Contact>("contacts", id, patch);
}

export const listPhoneNumbers = (userId: string) => store.list<PhoneNumber>("phoneNumbers", userId);
export const createPhoneNumber = (p: PhoneNumber) => store.insert("phoneNumbers", p);
export const insertPhoneNumbers = (rows: PhoneNumber[]) => store.insertMany("phoneNumbers", rows);
export async function updatePhoneNumber(userId: string, id: string, patch: Partial<PhoneNumber>) {
  const exists = (await listPhoneNumbers(userId)).some((p) => p.id === id);
  if (!exists) return null;
  return store.update<PhoneNumber>("phoneNumbers", id, patch);
}
export async function deletePhoneNumber(userId: string, id: string) {
  const exists = (await listPhoneNumbers(userId)).some((p) => p.id === id);
  if (!exists) return false;
  return store.remove("phoneNumbers", id);
}

// --- Appointments -----------------------------------------------------------
export const listAppointments = (userId: string) => store.list<Appointment>("appointments", userId);
export const createAppointment = (a: Appointment) => store.insert("appointments", a);
export async function updateAppointment(userId: string, id: string, patch: Partial<Appointment>) {
  const exists = (await listAppointments(userId)).some((a) => a.id === id);
  if (!exists) return null;
  return store.update<Appointment>("appointments", id, patch);
}
export async function deleteAppointment(userId: string, id: string) {
  const exists = (await listAppointments(userId)).some((a) => a.id === id);
  if (!exists) return false;
  return store.remove("appointments", id);
}

// --- Omnichannel ------------------------------------------------------------
export const listConversations = (userId: string) => store.list<Conversation>("conversations", userId);
export const createConversation = (c: Conversation) => store.insert("conversations", c);
export async function updateConversation(userId: string, id: string, patch: Partial<Conversation>) {
  const exists = (await listConversations(userId)).some((c) => c.id === id);
  if (!exists) return null;
  return store.update<Conversation>("conversations", id, patch);
}
export const listChatMessages = (userId: string) => store.list<ChatMessage>("chatMessages", userId);
export const createChatMessage = (m: ChatMessage) => store.insert("chatMessages", m);

export async function getChannelSettings(userId: string): Promise<ChannelSettings> {
  const rows = await store.list<ChannelSettings>("channels", userId);
  return (
    rows[0] ?? {
      id: `ch_${userId}`,
      userId,
      aiAutoReply: true,
      updatedAt: new Date().toISOString(),
    }
  );
}
export async function saveChannelSettings(userId: string, patch: Partial<ChannelSettings>): Promise<ChannelSettings> {
  const rows = await store.list<ChannelSettings>("channels", userId);
  const now = new Date().toISOString();
  if (rows[0]) {
    return (await store.update<ChannelSettings>("channels", rows[0].id, { ...patch, updatedAt: now }))!;
  }
  const row: ChannelSettings = {
    id: `ch_${userId}`,
    userId,
    aiAutoReply: true,
    ...patch,
    updatedAt: now,
  };
  return store.insert("channels", row);
}
// Find which workspace a Meta webhook event belongs to (by page/number id).
export async function findUserByChannelId(channelId: string): Promise<ChannelSettings | null> {
  const rows = await store.list<ChannelSettings>("channels");
  return (
    rows.find(
      (r) =>
        r.whatsapp?.phoneNumberId === channelId ||
        r.instagram?.pageId === channelId ||
        r.messenger?.pageId === channelId
    ) ?? null
  );
}

export const listWebhooks = (userId: string) => store.list<Webhook>("webhooks", userId);
export const createWebhook = (w: Webhook) => store.insert("webhooks", w);
export const insertWebhooks = (rows: Webhook[]) => store.insertMany("webhooks", rows);
export async function deleteWebhook(userId: string, id: string) {
  const exists = (await listWebhooks(userId)).some((w) => w.id === id);
  if (!exists) return false;
  return store.remove("webhooks", id);
}

export const listIntegrations = (userId: string) =>
  store.list<Integration>("integrations", userId);
export const createIntegration = (i: Integration) => store.insert("integrations", i);
export async function updateIntegration(
  userId: string,
  id: string,
  patch: Partial<Integration>
) {
  const exists = (await listIntegrations(userId)).some((i) => i.id === id);
  if (!exists) return undefined;
  return store.update<Integration>("integrations", id, patch);
}
export async function deleteIntegration(userId: string, id: string) {
  const exists = (await listIntegrations(userId)).some((i) => i.id === id);
  if (!exists) return false;
  return store.remove("integrations", id);
}

export const listKnowledgeBases = (userId: string) => store.list<KnowledgeBase>("knowledgeBases", userId);
export const createKnowledgeBase = (k: KnowledgeBase) => store.insert("knowledgeBases", k);
export const insertKnowledgeBases = (rows: KnowledgeBase[]) => store.insertMany("knowledgeBases", rows);
export async function updateKnowledgeBase(
  userId: string,
  id: string,
  patch: Partial<KnowledgeBase>
) {
  const exists = (await listKnowledgeBases(userId)).some((k) => k.id === id);
  if (!exists) return undefined;
  return store.update<KnowledgeBase>("knowledgeBases", id, patch);
}
export async function deleteKnowledgeBase(userId: string, id: string) {
  const exists = (await listKnowledgeBases(userId)).some((k) => k.id === id);
  if (!exists) return false;
  return store.remove("knowledgeBases", id);
}
