import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listWebhooks } from "@/lib/db";
import WebhooksPanel from "@/components/dashboard/WebhooksPanel";

export const metadata = { title: "Webhooks — VoiceLine AI" };

export default async function WebhooksPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const webhooks = await listWebhooks(session.userId);
  return <WebhooksPanel webhooks={webhooks} />;
}
