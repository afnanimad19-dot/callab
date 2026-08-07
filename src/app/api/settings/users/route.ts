import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import {
  createUser,
  findUserByEmail,
  listWorkspaceMembers,
  newId,
  updateUser,
  User,
} from "@/lib/db";
import { sendEmail } from "@/lib/email";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const members = await listWorkspaceMembers(session.userId);
  return NextResponse.json({
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role ?? "owner",
      status: m.status ?? "active",
      emailVerified: m.emailVerified ?? m.id === session.userId,
      createdAt: m.createdAt,
    })),
  });
}

// Invite a member: owner-only. Generates a random temporary password and a
// verification link; emails them when RESEND_API_KEY is set, otherwise
// returns them so the owner can share them directly.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "owner") {
    return NextResponse.json({ error: "Only the workspace owner can invite users." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim();
  const name = String(body?.name ?? "").trim() || email.split("@")[0];
  const role = ["supervisor", "viewer"].includes(body?.role) ? body.role : "supervisor";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (await findUserByEmail(email)) {
    return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
  }

  const tempPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const verifyToken = crypto.randomUUID().replace(/-/g, "");

  await createUser({
    id: newId("usr"),
    email,
    passwordHash: await bcrypt.hash(tempPassword, 10),
    company: session.company,
    name,
    createdAt: new Date().toISOString(),
    ownerId: session.userId,
    role,
    status: "invited",
    verifyToken,
    emailVerified: false,
    mustResetPassword: true,
  } as User);

  const origin = new URL(request.url).origin;
  const verifyUrl = `${origin}/api/verify?token=${verifyToken}`;
  const emailed = await sendEmail({
    to: email,
    subject: `You've been invited to ${session.company} on VoiceLine AI`,
    html: `<p>${session.name} invited you to the <strong>${session.company}</strong> workspace.</p>
<p><a href="${verifyUrl}">Click here to verify your email</a>, then log in at <a href="${origin}/login">${origin}/login</a> with:</p>
<p>Email: <strong>${email}</strong><br/>Temporary password: <strong>${tempPassword}</strong></p>
<p>You'll be asked to set your own password after logging in (Settings → Profile).</p>`,
  });

  return NextResponse.json(
    {
      ok: true,
      emailed,
      // Fallback for when email isn't configured: the owner shares these.
      ...(emailed ? {} : { tempPassword, verifyUrl }),
    },
    { status: 201 }
  );
}

// Owner can change a member's role or block/unblock them.
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "owner") {
    return NextResponse.json({ error: "Only the workspace owner can manage users." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const memberId = String(body?.memberId ?? "");
  const members = await listWorkspaceMembers(session.userId);
  const member = members.find((m) => m.id === memberId && m.id !== session.userId);
  if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404 });

  const patch: Partial<User> = {};
  if (["supervisor", "viewer"].includes(body?.role)) patch.role = body.role;
  if (["active", "blocked"].includes(body?.status)) patch.status = body.status;
  await updateUser(member.id, patch);
  return NextResponse.json({ ok: true });
}
