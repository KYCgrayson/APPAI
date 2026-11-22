import { db } from "@/lib/db";
import { loadAdminFeedback } from "@/lib/feedback";
export const dynamic = "force-dynamic";
export default async function AdminFeedbackPage() {
  const entries = await loadAdminFeedback(() => db.feedback.findMany({ orderBy: { createdAt: "desc" }, take: 200 }));
  if (entries === null) return <div><h1 className="text-2xl font-bold mb-6">Feedback</h1><p>Feedback table not created yet</p></div>;
  return <div><h1 className="text-2xl font-bold mb-6">Feedback</h1><p className="mb-4 text-gray-500">Latest 200 submissions</p><div className="space-y-4">{entries.map(entry => <article key={entry.id} className="bg-white rounded-xl p-5 shadow-sm break-words">
    <div className="flex flex-wrap gap-3 font-semibold"><span>{entry.kind}</span><span>{entry.source}</span><span>{entry.status}</span></div>
    <p className="text-sm text-gray-500">{entry.createdAt.toISOString()} · {entry.contactEmail}</p>
    {entry.pageSlug && <p>Page: {entry.pageSlug}</p>}{entry.specUrl && <p>Spec: {entry.specUrl}</p>}
    <p className="whitespace-pre-wrap mt-3">{entry.message}</p>
  </article>)}{entries.length === 0 && <p>No feedback yet.</p>}</div></div>;
}
