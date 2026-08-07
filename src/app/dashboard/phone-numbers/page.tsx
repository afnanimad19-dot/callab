import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listPhoneNumbers } from "@/lib/db";
import PhoneNumbersPanel from "@/components/dashboard/PhoneNumbersPanel";

export const metadata = { title: "Phone Numbers — VoiceLine AI" };

export default async function PhoneNumbersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const numbers = await listPhoneNumbers(session.userId);
  return <PhoneNumbersPanel numbers={numbers} />;
}
