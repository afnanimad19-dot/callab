import { NextResponse } from "next/server";
import { getSession, createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { createUser, findUserById, findDataOwner, listWorkspacesFor, newId } from "@/lib/db";
import { workspaceLimit, getPlanTier } from "@/lib/plans";

function label(w: { id: string; company?: string }, rootId: string) {
  return w.id === rootId ? (w.company || "Default Workspace") : (w.company || "Workspace");
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { rootId, workspaces } = await listWorkspacesFor(session.userId);
  const owner = await findUserById(rootId);
  const limit = workspaceLimit(owner);
  return NextResponse.json({
    active: session.userId,
    limit,
    canAdd: workspaces.length < limit,
    planName: getPlanTier(owner).name,
    workspaces: workspaces.map((w) => ({
      id: w.id,
      name: label(w, rootId),
      isDefault: w.id === rootId,
    })),
  });
}

// action: "create" { name }  |  "switch" { workspaceId }
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  const owner = await findDataOwner(session.userId);
  const rootId = owner?.id ?? session.ownerId ?? session.userId;

  async function issue(userId: string, company: string) {
    const token = await createSessionToken({
      userId,
      email: session!.email,
      name: session!.name,
      company,
      memberId: session!.memberId,
      ownerId: rootId,
      role: session!.role,
    });
    const res = NextResponse.json({ ok: true, active: userId });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  }

  if (action === "create") {
    if (session.role && session.role !== "owner") {
      return NextResponse.json({ error: "Only the account owner can add workspaces." }, { status: 403 });
    }
    const { workspaces } = await listWorkspacesFor(rootId);
    const limit = workspaceLimit(owner);
    if (workspaces.length >= limit) {
      return NextResponse.json(
        { error: `Your ${getPlanTier(owner).name} plan includes ${limit} workspace${limit === 1 ? "" : "s"}. Upgrade to add more.`, upgrade: true },
        { status: 403 }
      );
    }
    const name = String(body?.name ?? "").trim().slice(0, 60) || "New Workspace";
    const id = newId("ws");
    await createUser({
      id,
      email: `workspace+${id}@voiceline.local`,
      passwordHash: "", // headless — can't be logged into directly
      company: name,
      name: owner?.name ?? session.name,
      createdAt: new Date().toISOString(),
      ownerId: rootId,
      isWorkspace: true,
      planTier: owner?.planTier, // inherit the account's plan
    });
    return issue(id, name); // switch straight into the fresh workspace
  }

  if (action === "switch") {
    const target = await findUserById(String(body?.workspaceId ?? ""));
    const allowed = target && (target.id === rootId || (target.ownerId === rootId && target.isWorkspace));
    if (!target || !allowed) return NextResponse.json({ error: "Unknown workspace." }, { status: 404 });
    const company = target.id === rootId ? (owner?.company || "Default Workspace") : (target.company || "Workspace");
    return issue(target.id, company);
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
