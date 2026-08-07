// Test Knowledge Base chat: a lightweight keyword-retrieval preview.
//
// Searches the selected knowledge bases' stored name/description/content
// for the question's terms and returns the best-matching snippets. Real
// RAG (embeddings + retrieval feeding the live agent) lands with the Vapi
// knowledge sync — this endpoint makes the Test panel usable today and is
// honest in its reply about being a retrieval preview.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listKnowledgeBases } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const question = String(body?.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "Ask a question first." }, { status: 400 });
  }
  const ids: string[] = Array.isArray(body?.kbIds) ? body.kbIds.map(String) : [];
  const searchAll = Boolean(body?.searchAll);

  const all = await listKnowledgeBases(session.userId);
  const scope = searchAll ? all : all.filter((k) => ids.includes(k.id));
  if (scope.length === 0) {
    return NextResponse.json({
      answer: 'Select knowledge base(s) or enable "Search all" first.',
      sources: [],
    });
  }

  const terms = question.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  const scored = scope
    .map((kb) => {
      const haystack = `${kb.name} ${kb.description} ${kb.content ?? ""} ${kb.url ?? ""}`.toLowerCase();
      const hits = terms.filter((t) => haystack.includes(t));
      // Pull a snippet around the first matching term in the content.
      let snippet = "";
      const content = kb.content ?? "";
      const idx = hits.length ? content.toLowerCase().indexOf(hits[0]) : -1;
      if (idx >= 0) {
        snippet = content.slice(Math.max(0, idx - 60), idx + 160).trim();
      }
      return { kb, score: hits.length, snippet };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return NextResponse.json({
      answer: `No matches for "${question}" in the selected knowledge base(s). Add more content, or rephrase the question.`,
      sources: [],
    });
  }

  const top = scored[0];
  const answer = top.snippet
    ? `Based on “${top.kb.name}”: …${top.snippet}…`
    : `“${top.kb.name}” (${top.kb.description}) matches your question. Full RAG answers activate once knowledge sync to the voice pipeline is connected.`;

  return NextResponse.json({
    answer,
    sources: scored.slice(0, 3).map((r) => r.kb.name),
  });
}
