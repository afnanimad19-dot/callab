import EmbedWidget from "@/components/EmbedWidget";

export const metadata = { title: "Talk to our AI agent" };

// Public, standalone page meant to be iframed into any website. It renders
// a call button for a PUBLIC agent — no login, no dashboard chrome.
export default async function EmbedPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  return <EmbedWidget agentId={agentId} />;
}
