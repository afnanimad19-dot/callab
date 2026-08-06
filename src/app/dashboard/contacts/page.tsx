import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listContacts } from "@/lib/db";
import QuickCreateForm from "@/components/dashboard/QuickCreateForm";

export const metadata = { title: "Contacts — VoiceLine AI" };

export default async function ContactsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const contacts = (await listContacts(session.userId)).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="mt-1 text-sm text-ink-400">
            The people your outbound campaigns call.
          </p>
        </div>
        <QuickCreateForm
          endpoint="/api/contacts"
          buttonLabel="+ Add contact"
          fields={[
            { name: "name", label: "Name", placeholder: "Jordan Reyes", required: true },
            { name: "phone", label: "Phone", placeholder: "+1 (415) 555-0100", required: true },
            { name: "tag", label: "Tag", placeholder: "lead" },
          ]}
        />
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Phone</th>
              <th className="px-5 py-3 font-medium">Tag</th>
              <th className="px-5 py-3 font-medium">Added</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700/70">
            {contacts.map((c) => (
              <tr key={c.id}>
                <td className="px-5 py-3 font-medium">{c.name}</td>
                <td className="px-5 py-3 font-mono text-[13px] text-ink-300">{c.phone}</td>
                <td className="px-5 py-3">
                  <span className="badge-muted">{c.tag}</span>
                </td>
                <td className="px-5 py-3 text-ink-400">
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {contacts.length === 0 && (
          <p className="px-5 py-8 text-sm text-ink-400">No contacts yet.</p>
        )}
      </div>
    </div>
  );
}
