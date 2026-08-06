import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listKnowledgeBases } from "@/lib/db";
import QuickCreateForm from "@/components/dashboard/QuickCreateForm";

export const metadata = { title: "Knowledge Bases — VoiceLine AI" };

export default async function KnowledgePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const kbs = await listKnowledgeBases(session.userId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Knowledge Bases</h1>
          <p className="mt-1 text-sm text-ink-400">
            The documents your agents answer from. Document upload &amp;
            embeddings connect in the Supabase phase (see README).
          </p>
        </div>
        <QuickCreateForm
          endpoint="/api/knowledge"
          buttonLabel="+ New knowledge base"
          fields={[
            { name: "name", label: "Name", placeholder: "Company FAQ", required: true },
            { name: "description", label: "Description", placeholder: "Hours, pricing, and policies." },
          ]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {kbs.map((kb) => (
          <div key={kb.id} className="card">
            <div className="flex items-start justify-between">
              <h2 className="text-base font-semibold">{kb.name}</h2>
              <span className="badge-muted">{kb.docsCount} docs</span>
            </div>
            <p className="mt-2 text-sm text-ink-300">{kb.description || "No description."}</p>
            <p className="mt-3 text-xs text-ink-400">
              Created {new Date(kb.createdAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
      {kbs.length === 0 && (
        <div className="card py-10 text-center text-sm text-ink-400">
          No knowledge bases yet.
        </div>
      )}
    </div>
  );
}
