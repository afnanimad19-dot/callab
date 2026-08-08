import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listAppointments } from "@/lib/db";
import { bookAppointment } from "@/lib/appointments";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const appointments = await listAppointments(session.userId);
  return NextResponse.json({ appointments });
}

// Manual "+ New Appointment" from the Calendar tab.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);

  const patientName = String(body?.patientName ?? "").trim();
  const startsAt = String(body?.startsAt ?? "");
  if (!patientName) return NextResponse.json({ error: "Patient name is required." }, { status: 400 });
  if (Number.isNaN(Date.parse(startsAt))) {
    return NextResponse.json({ error: "Pick a valid date and time." }, { status: 400 });
  }

  const appointment = await bookAppointment(session.userId, {
    patientName,
    phone: String(body?.phone ?? "").slice(0, 30),
    doctor: String(body?.doctor ?? "").slice(0, 80),
    service: String(body?.service ?? "").slice(0, 120),
    startsAt: new Date(startsAt).toISOString(),
    endsAt: body?.endsAt && !Number.isNaN(Date.parse(body.endsAt)) ? new Date(body.endsAt).toISOString() : undefined,
    notes: String(body?.notes ?? "").slice(0, 1000),
    source: "manual",
  });
  return NextResponse.json({ appointment }, { status: 201 });
}
