import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findUserById, newId, updateUser } from "@/lib/db";

// Returns the workspace API key, generating one on first request.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await findUserById(session.userId);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let apiKey = user.apiKey;
  if (!apiKey) {
    apiKey = `vl_${newId("key").slice(4)}${crypto.randomUUID().replace(/-/g, "")}`;
    await updateUser(session.userId, { apiKey });
  }
  return NextResponse.json({ apiKey });
}
