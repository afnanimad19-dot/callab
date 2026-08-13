// Core Google OAuth shared by the two independent integrations: Calendar and
// Sheets. One Google Cloud OAuth app (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)
// serves every customer, but each SERVICE is connected separately — so a
// clinic can point Calendar at one Google account and Sheets at another.
// Refresh tokens live on the user record under googleServices[service];
// provider secrets never touch the database. (Customer emails are sent via
// Resend — see notify.ts — not Google.)

import { findUserById, updateUser, type User, type GoogleConn } from "./db";

export type GoogleService = "calendar" | "sheets";
export const GOOGLE_SERVICES: GoogleService[] = ["calendar", "sheets"];

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// Per-service scopes. Calendar + Sheets are both "sensitive" scopes.
const SCOPES: Record<GoogleService, string[]> = {
  calendar: ["https://www.googleapis.com/auth/calendar.events"],
  sheets: ["https://www.googleapis.com/auth/spreadsheets"],
};

export function googleAuthUrl(service: GoogleService, redirectUri: string, userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [...SCOPES[service], "openid", "email"].join(" "),
    access_type: "offline",
    prompt: "consent", // always return a refresh token
    include_granted_scopes: "true",
    state: `${userId}::${service}`,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function parseState(state: string | null): { userId: string; service: GoogleService } | null {
  if (!state) return null;
  const idx = state.lastIndexOf("::");
  if (idx < 0) return null;
  const userId = state.slice(0, idx);
  const service = state.slice(idx + 2) as GoogleService;
  if (!GOOGLE_SERVICES.includes(service) || !userId) return null;
  return { userId, service };
}

export async function exchangeCode(
  code: string,
  redirectUri: string
): Promise<{ refreshToken?: string; email?: string } | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { refresh_token?: string; id_token?: string };
    let email: string | undefined;
    if (data.id_token) {
      try {
        const payload = JSON.parse(Buffer.from(data.id_token.split(".")[1], "base64").toString());
        email = payload.email;
      } catch { /* fine without it */ }
    }
    return { refreshToken: data.refresh_token, email };
  } catch {
    return null;
  }
}

// One-time migration: the old single connection stored a token with BOTH the
// calendar and sheets scopes. Fold it into the new per-service shape so the
// clinic that was already connected stays connected without re-authing.
function migrateLegacy(user: User): NonNullable<User["googleServices"]> {
  const services = { ...(user.googleServices ?? {}) };
  if (user.googleRefreshToken) {
    if (!services.calendar) {
      services.calendar = { refreshToken: user.googleRefreshToken, email: user.googleEmail };
    }
    if (!services.sheets) {
      services.sheets = {
        refreshToken: user.googleRefreshToken,
        email: user.googleEmail,
        spreadsheetId: user.googleSheetId,
      };
    }
  }
  return services;
}

// Returns the connection for a service. The sheets extras (spreadsheetId etc.)
// are present only on the sheets connection; they're typed here as optional so
// a single signature works for all three services.
export type ServiceConn = GoogleConn & {
  spreadsheetId?: string;
  spreadsheetName?: string;
  sheetTab?: string;
  columns?: string[];
  mapping?: Record<string, string>;
};
export function getServiceConn(user: User, service: GoogleService): ServiceConn | null {
  const services = migrateLegacy(user);
  return (services[service] as ServiceConn | undefined) ?? null;
}

export function serviceConnected(user: User | undefined | null, service: GoogleService): boolean {
  return Boolean(user && getServiceConn(user, service)?.refreshToken);
}

// Store / merge a service connection (and clear any legacy fields once we've
// written the new shape).
export async function saveServiceConn(
  userId: string,
  service: GoogleService,
  patch: Partial<NonNullable<User["googleServices"]>[GoogleService]>
): Promise<void> {
  const user = await findUserById(userId);
  if (!user) return;
  const services = migrateLegacy(user);
  services[service] = { ...(services[service] ?? {}), ...patch } as never;
  await updateUser(userId, {
    googleServices: services,
    googleRefreshToken: undefined,
    googleEmail: undefined,
    googleSheetId: undefined,
  });
}

export async function disconnectService(userId: string, service: GoogleService): Promise<void> {
  const user = await findUserById(userId);
  if (!user) return;
  const services = migrateLegacy(user);
  delete services[service];
  await updateUser(userId, {
    googleServices: services,
    googleRefreshToken: undefined,
    googleEmail: undefined,
    googleSheetId: undefined,
  });
}

// Exchange the stored refresh token for a short-lived access token for one
// service's connected account.
export async function accessTokenForService(user: User, service: GoogleService): Promise<string | null> {
  const conn = getServiceConn(user, service);
  if (!conn?.refreshToken || !googleConfigured()) return null;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: conn.refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { access_token?: string }).access_token ?? null;
  } catch {
    return null;
  }
}
