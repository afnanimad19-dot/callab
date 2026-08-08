import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createPhoneNumber, listPhoneNumbers, newId, PhoneNumber } from "@/lib/db";
import { importTwilioNumber, importSipNumber, findVapiNumber, vapiConfigured } from "@/lib/vapi";

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
  const e164 = `+${number.replace(/[^\d]/g, "")}`;
  const nickname = String(body?.nickname ?? "").slice(0, 60);

  // Link the number in Vapi so inbound/outbound calling actually works.
  // Credentials (Twilio SID/token, SIP username/password) are forwarded to
  // Vapi at connect time — they are deliberately NOT stored in our database.
  let vapiPhoneNumberId: string | undefined;
  let linkError: string | undefined;
  if (vapiConfigured()) {
    try {
      if (provider === "Twilio (BYOT)") {
        const sid = String(body?.twilioAccountSid ?? "").trim();
        const token = String(body?.twilioAuthToken ?? "").trim();
        if (!sid || !token) {
          return NextResponse.json(
            { error: "Twilio Account SID and Auth Token are required to connect the number." },
            { status: 400 }
          );
        }
        vapiPhoneNumberId =
          (await importTwilioNumber({ number: e164, accountSid: sid, authToken: token, name: nickname || e164 })) ??
          undefined;
      } else if (provider === "Vapi") {
        vapiPhoneNumberId = (await findVapiNumber(e164)) ?? undefined;
        if (!vapiPhoneNumberId) {
          linkError = "Number not found in your Vapi account — provision it in Vapi → Phone Numbers first.";
        }
      } else {
        const gateway = String(body?.sipHost ?? "").trim();
        if (gateway) {
          vapiPhoneNumberId =
            (await importSipNumber({
              number: e164,
              gateway,
              username: String(body?.sipUser ?? "").trim() || undefined,
              password: String(body?.sipPass ?? "").trim() || undefined,
              name: nickname || e164,
            })) ?? undefined;
        }
      }
    } catch (e) {
      linkError = `Voice-pipeline link failed: ${(e as Error).message.slice(0, 300)}`;
      console.error("Phone number link failed:", e);
    }
  }

  const now = new Date().toISOString();
  const phoneNumber: PhoneNumber = await createPhoneNumber({
    id: newId("num"),
    userId: session.userId,
    number,
    provider,
    agentName: "",
    status: vapiPhoneNumberId ? "active" : "unassigned",
    createdAt: now,
    updatedAt: now,
    nickname,
    numberType: ["national", "local", "toll-free"].includes(body?.numberType)
      ? body.numberType
      : "national",
    scope: "Global",
    vapiPhoneNumberId,
  });

  return NextResponse.json(
    { phoneNumber, linked: Boolean(vapiPhoneNumberId), linkError },
    { status: 201 }
  );
}
