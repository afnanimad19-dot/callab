import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listAppointments } from "@/lib/db";
import CalendarPanel from "@/components/dashboard/CalendarPanel";

export const metadata = { title: "Calendar — VoiceLine AI" };

export default async function CalendarPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const appointments = await listAppointments(session.userId);
  return <CalendarPanel appointments={appointments} />;
}
