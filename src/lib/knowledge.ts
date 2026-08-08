// Builds the knowledge text injected into an agent's system prompt at Vapi
// sync time. Reading the attached Knowledge Base resources HERE (not at save
// time) means editing a resource automatically updates every agent using it
// on their next publish/test.

import { listKnowledgeBases } from "./db";

const PER_RESOURCE_LIMIT = 8000;
const TOTAL_LIMIT = 30000;

export async function buildKnowledgeText(
  userId: string,
  ids: string[] | undefined
): Promise<string> {
  if (!ids?.length) return "";
  const all = await listKnowledgeBases(userId);
  const selected = all.filter((k) => ids.includes(k.id));
  if (selected.length === 0) return "";

  let total = 0;
  const parts: string[] = [];
  for (const kb of selected) {
    const body =
      kb.content?.trim() ||
      (kb.url ? `Reference material lives at: ${kb.url}` : "(no content)");
    const chunk = `## ${kb.name}\n${body.slice(0, PER_RESOURCE_LIMIT)}`;
    if (total + chunk.length > TOTAL_LIMIT) break;
    total += chunk.length;
    parts.push(chunk);
  }
  if (parts.length === 0) return "";

  return `# Knowledge Base
Use the following verified business knowledge to answer questions. Prefer these facts over guesses; if the answer isn't covered here, say you'll check and offer a follow-up.

${parts.join("\n\n")}`;
}
