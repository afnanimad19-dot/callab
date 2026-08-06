// Lightweight file-backed data store for local development.
//
// Every function here is the single point of contact with storage, so
// swapping this file for a real database (Postgres + Prisma/Drizzle) later
// only requires re-implementing these functions — no route or page changes.

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
  createdAt: string;
}

export interface TranscriptTurn {
  speaker: "agent" | "caller" | "supervisor";
  text: string;
  at: number; // seconds from call start
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
  sentiment: "positive" | "neutral" | "negative";
  confidence: number; // 0..1
  summary: string;
  transcript: TranscriptTurn[];
}

interface Database {
  users: User[];
  agents: Agent[];
  calls: Call[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function load(): Database {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as Database;
  } catch {
    return { users: [], agents: [], calls: [] };
  }
}

function save(db: Database) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

// --- users ---

export function findUserByEmail(email: string): User | undefined {
  return load().users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );
}

export function findUserById(id: string): User | undefined {
  return load().users.find((u) => u.id === id);
}

export function createUser(user: User): User {
  const db = load();
  db.users.push(user);
  save(db);
  return user;
}

// --- agents ---

export function listAgents(userId: string): Agent[] {
  return load().agents.filter((a) => a.userId === userId);
}

export function findAgent(userId: string, id: string): Agent | undefined {
  return load().agents.find((a) => a.userId === userId && a.id === id);
}

export function createAgent(agent: Agent): Agent {
  const db = load();
  db.agents.push(agent);
  save(db);
  return agent;
}

export function updateAgent(
  userId: string,
  id: string,
  patch: Partial<Agent>
): Agent | undefined {
  const db = load();
  const agent = db.agents.find((a) => a.userId === userId && a.id === id);
  if (!agent) return undefined;
  Object.assign(agent, patch, { id: agent.id, userId: agent.userId });
  save(db);
  return agent;
}

export function deleteAgent(userId: string, id: string): boolean {
  const db = load();
  const before = db.agents.length;
  db.agents = db.agents.filter((a) => !(a.userId === userId && a.id === id));
  save(db);
  return db.agents.length < before;
}

// --- calls ---

export function listCalls(userId: string): Call[] {
  return load()
    .calls.filter((c) => c.userId === userId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function findCall(userId: string, id: string): Call | undefined {
  return load().calls.find((c) => c.userId === userId && c.id === id);
}

export function insertCalls(calls: Call[]) {
  const db = load();
  db.calls.push(...calls);
  save(db);
}
