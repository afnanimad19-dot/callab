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
  update<T extends Row>(table: Table, id: string, patch: Partial<T>): Promise<T | undefined>;
  remove(table: Table, id: string): Promise<boolean>;
}

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

const fileStore: Store = {
  async list(table, userId) {
    let db: Database;
    try {
      db = { ...EMPTY, ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) };
    } catch {
      db = EMPTY;
    }
    const rows = db[table] as Row[];
    return (userId
      ? rows.filter((r) => "userId" in r && r.userId === userId)
      : rows) as never;
  },
  async insert(table, row) {
    let db: Database;
    try {
      db = { ...EMPTY, ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) };
    } catch {
      db = { ...EMPTY, users: [], agents: [], calls: [], campaigns: [], contacts: [], phoneNumbers: [], webhooks: [], knowledgeBases: [] };
    }
    (db[table] as Row[]).push(row);
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    return row;
  },
  async update(table, id, patch) {
    const db: Database = { ...EMPTY, ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) };
    const row = (db[table] as Row[]).find((r) => r.id === id);
    if (!row) return undefined;
    Object.assign(row, patch, { id: row.id });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    return row as never;
  },
  async remove(table, id) {
    const db: Database = { ...EMPTY, ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) };
    const rows = db[table] as Row[];
    const next = rows.filter((r) => r.id !== id);
    (db[table] as Row[]) = next as never;
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
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
    throw new Error(`Supabase ${res.status}: ${await res.text()}`);
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
      body: JSON.stringify({
        id: row.id,
        user_id: "userId" in row ? row.userId : null,
        data: row,
      }),
    });
    return row;
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
export async function insertCalls(calls: Call[]) {
  for (const c of calls) await store.insert("calls", c);
}

export const listCampaigns = (userId: string) => store.list<Campaign>("campaigns", userId);
export const createCampaign = (c: Campaign) => store.insert("campaigns", c);
export async function updateCampaign(userId: string, id: string, patch: Partial<Campaign>) {
  const exists = (await listCampaigns(userId)).some((c) => c.id === id);
  if (!exists) return undefined;
  return store.update<Campaign>("campaigns", id, patch);
}

export const listContacts = (userId: string) => store.list<Contact>("contacts", userId);
export const createContact = (c: Contact) => store.insert("contacts", c);

export const listPhoneNumbers = (userId: string) => store.list<PhoneNumber>("phoneNumbers", userId);
export const createPhoneNumber = (p: PhoneNumber) => store.insert("phoneNumbers", p);

export const listWebhooks = (userId: string) => store.list<Webhook>("webhooks", userId);
export const createWebhook = (w: Webhook) => store.insert("webhooks", w);

export const listKnowledgeBases = (userId: string) => store.list<KnowledgeBase>("knowledgeBases", userId);
export const createKnowledgeBase = (k: KnowledgeBase) => store.insert("knowledgeBases", k);
