import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { findUserById } from "@/lib/db";
import SettingsTabs from "@/components/dashboard/SettingsTabs";

export const metadata = { title: "Settings — VoiceLine AI" };

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await findUserById(session.userId);

  return (
    <SettingsTabs
      session={{
        name: session.name,
        email: session.email,
        company: session.company,
        createdAt: user
          ? new Date(user.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : undefined,
      }}
    />
  );
}
