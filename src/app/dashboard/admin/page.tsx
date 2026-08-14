import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/admin";
import AdminPanel from "@/components/dashboard/AdminPanel";

export const metadata = { title: "Admin — VoiceLine AI" };

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isPlatformAdmin(session.email)) redirect("/dashboard");
  return <AdminPanel />;
}
