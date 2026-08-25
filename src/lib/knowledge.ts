// Builds the knowledge text injected into an agent's system prompt at Vapi
// sync time. Reading the attached Knowledge Base resources HERE (not at save
// time) means editing a resource automatically updates every agent using it
// on their next publish/test.

import { listKnowledgeBases, updateKnowledgeBase } from "./db";
import { fetchWebsiteText } from "./web-content";

// Generous limits so long documents (e.g. a full test price list) survive
// intact — a truncated price table is worse than none: the list often sits at
// the END of the document, so cutting at N chars silently deletes exactly the
// facts the agent gets asked about. ~90k chars ≈ 22k tokens, within the voice
// LLM's context.
const PER_RESOURCE_LIMIT = 60000;
const TOTAL_LIMIT = 90000;

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
    // URL resources whose fetch failed at creation: retry here (at publish
    // time) so the agent actually reads the page, and persist the result so
    // future syncs are instant.
    if (kb.url && !kb.content?.trim()) {
      try {
        const fetched = await fetchWebsiteText(kb.url, { crawl: true });
        if (fetched?.content?.trim()) {
          kb.content = fetched.content;
          await updateKnowledgeBase(userId, kb.id, { content: fetched.content }).catch(() => {});
        }
      } catch { /* keep the link-only fallback */ }
    }
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
