import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listContacts } from "@/lib/db";
import ContactsPanel from "@/components/dashboard/ContactsPanel";

export const metadata = { title: "Contacts — VoiceLine AI" };

export default async function ContactsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const contacts = await listContacts(session.userId);
  return <ContactsPanel contacts={contacts} />;
}
