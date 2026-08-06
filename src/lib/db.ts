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

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  company: string;
  name: string;
  createdAt: string;
}

export interface Agent {
  id: string;
  userId: string;
  name: string;
  role: string;
  voice: string;
  language: string;
  greeting: string;
  systemPrompt: string;
  phoneNumber: string;
  status: "active" | "paused" | "draft";
  vapiAssistantId?: string;
  createdAt: string;
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
}

export interface Campaign {
  id: string;
  userId: string;
  name: string;
  agentId: string;
  agentName: string;
  goal: string;
  status: "draft" | "running" | "paused" | "completed";
  contactsTotal: number;
  contactsCalled: number;
  createdAt: string;
}

export interface Contact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  tag: string;
  createdAt: string;
}

export interface PhoneNumber {
  id: string;
  userId: string;
  number: string;
  provider: string;
  agentName: string;
  status: "active" | "unassigned";
  createdAt: string;
}

export interface Webhook {
  id: string;
  userId: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

export interface KnowledgeBase {
  id: string;
  userId: string;
  name: string;
  description: string;
  docsCount: number;
  createdAt: string;
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
      : "";
    throw new Error(`Supabase ${res.status}: ${text}${hint}`);
  }
  return res;
}

const supabaseStore: Store = {
  async list(table, userId) {
    const t = TABLE_NAMES[table];
    const filter = userId ? `&user_id=eq.${encodeURIComponent(userId)}` : "";
    const res = await rest(`${t}?select=data${filter}`);
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

export const listAgents = (userId: string) => store.list<Agent>("agents", userId);
export async function findAgent(userId: string, id: string) {
  return (await listAgents(userId)).find((a) => a.id === id);
}
export const createAgent = (a: Agent) => store.insert("agents", a);
export const insertAgents = (rows: Agent[]) => store.insertMany("agents", rows);
// Used by the Vapi webhook to route an incoming call to the right workspace,
// since the webhook only knows the Vapi assistant id (across all users).
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

export const listCampaigns = (userId: string) => store.list<Campaign>("campaigns", userId);
export const createCampaign = (c: Campaign) => store.insert("campaigns", c);
export const insertCampaigns = (rows: Campaign[]) => store.insertMany("campaigns", rows);
export async function updateCampaign(userId: string, id: string, patch: Partial<Campaign>) {
  const exists = (await listCampaigns(userId)).some((c) => c.id === id);
  if (!exists) return undefined;
  return store.update<Campaign>("campaigns", id, patch);
}

export const listContacts = (userId: string) => store.list<Contact>("contacts", userId);
export const createContact = (c: Contact) => store.insert("contacts", c);
export const insertContacts = (rows: Contact[]) => store.insertMany("contacts", rows);
export const deleteContact = (id: string) => store.remove("contacts", id);

export const listPhoneNumbers = (userId: string) => store.list<PhoneNumber>("phoneNumbers", userId);
export const createPhoneNumber = (p: PhoneNumber) => store.insert("phoneNumbers", p);
export const insertPhoneNumbers = (rows: PhoneNumber[]) => store.insertMany("phoneNumbers", rows);

export const listWebhooks = (userId: string) => store.list<Webhook>("webhooks", userId);
export const createWebhook = (w: Webhook) => store.insert("webhooks", w);
export const insertWebhooks = (rows: Webhook[]) => store.insertMany("webhooks", rows);

export const listKnowledgeBases = (userId: string) => store.list<KnowledgeBase>("knowledgeBases", userId);
export const createKnowledgeBase = (k: KnowledgeBase) => store.insert("knowledgeBases", k);
export const insertKnowledgeBases = (rows: KnowledgeBase[]) => store.insertMany("knowledgeBases", rows);
