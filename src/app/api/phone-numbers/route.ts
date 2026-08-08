import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createPhoneNumber, listPhoneNumbers, newId, PhoneNumber } from "@/lib/db";

const PROVIDERS = ["Vapi", "Twilio (BYOT)", "Custom SIP Trunk"];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ phoneNumbers: await listPhoneNumbers(session.userId) });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const number = String(body?.number ?? "").trim();
  if (!/^\+?[\d\s()\-]{6,20}$/.test(number)) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }
  const provider = PROVIDERS.includes(body?.provider) ? body.provider : "Custom SIP Trunk";

  // NOTE: provider credentials (Twilio SID/token, SIP username/password) are
  // forwarded to the voice pipeline at connect time — they are deliberately
  // NOT stored in our database.

  const now = new Date().toISOString();
  const phoneNumber: PhoneNumber = await createPhoneNumber({
    id: newId("num"),
    userId: session.userId,
    number,
    provider,
    agentName: "",
    status: "active",
    createdAt: now,
    updatedAt: now,
    nickname: String(body?.nickname ?? "").slice(0, 60),
    numberType: ["national", "local", "toll-free"].includes(body?.numberType)
      ? body.numberType
      : "national",
    scope: "Global",
  });

  return NextResponse.json({ phoneNumber }, { status: 201 });
}
