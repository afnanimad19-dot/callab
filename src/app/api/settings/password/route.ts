import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import { findUserById, updateUser } from "@/lib/db";

// Change your own password (Settings → Profile, and the forced reset after
// logging in with an emailed temporary password).
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const currentPassword = String(body?.currentPassword ?? "");
  const newPassword = String(body?.newPassword ?? "");
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters." },
      { status: 400 }
    );
  }

  // memberId is the logged-in user's OWN record (userId is the workspace owner).
  const selfId = session.memberId ?? session.userId;
  const user = await findUserById(selfId);
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  await updateUser(user.id, {
    passwordHash: await bcrypt.hash(newPassword, 10),
    mustResetPassword: false,
  });
  return NextResponse.json({ ok: true });
}
