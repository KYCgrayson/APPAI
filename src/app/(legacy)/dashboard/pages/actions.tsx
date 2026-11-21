"use client";
import { useRef, useState, type ReactNode, type MouseEvent } from "react";
import { useRouter } from "next/navigation";

type Action = "unpublish" | "delete" | "restore";
type Scope = { pages: number; rows: number; children: number; titles: string[]; includesRoot: boolean; skipped: { id: string; slug: string; locale: string; reason: string }[] };
export function PageActionButtons({ id, locked = false }: { id: string; locked?: boolean }) {
  return <span className="flex flex-wrap gap-2" title={locked ? "Locked by an administrator. Only an administrator can restore this page." : undefined}>
    {(["unpublish", "delete", "restore"] as const).map(action => <button type="button" key={action} data-page-action={action} data-target={id} disabled={locked}
      className="rounded border px-3 py-1 text-sm capitalize disabled:opacity-40">{action}</button>)}
  </span>;
}
export function PageActions({ children, endpoint = "/api/dashboard/pages/actions" }: { children: ReactNode; endpoint?: string }) {
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pending, setPending] = useState<{ action: Action; targets: string[]; scope: Scope } | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function send(body: object) {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.code === "scope_changed" ? "The affected pages changed. Review and confirm again." : result.error || "Action failed");
    return result;
  }
  async function begin(event: MouseEvent<HTMLFormElement>) {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-page-action]");
    if (!button || button.disabled || busy) return;
    const action = button.dataset.pageAction as Action;
    const targets = button.dataset.target ? [button.dataset.target] : new FormData(form.current!).getAll("targets").map(String);
    if (!targets.length) { setMessage("Select at least one page."); return; }
    setBusy(true); setMessage("");
    try { const scope = await send({ action, targets, dryRun: true }); setTyped(""); setPending({ action, targets, scope }); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  async function confirmAction() {
    if (!pending) return;
    setBusy(true);
    try {
      const result = await send({ action: pending.action, targets: pending.targets, expected: { pages: pending.scope.pages, rows: pending.scope.rows } });
      setPending(null);
      setMessage(result.cacheRefreshed ? "Pages updated." : "Pages updated. Index updates may take up to 1 hour.");
      router.refresh();
    } catch (error) { setPending(null); setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  const needsWord = pending?.action === "delete" && (pending.scope.includesRoot || pending.scope.pages > 10);
  return <>
    <form ref={form} onSubmit={event => event.preventDefault()} onClick={begin}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm">Selected pages:</span>
        {(["unpublish", "delete", "restore"] as const).map(action => <button key={action} type="button" data-page-action={action} disabled={busy} className="rounded border bg-white px-3 py-2 text-sm capitalize disabled:opacity-40">{action}</button>)}
      </div>
      {children}
    </form>
    {message && <p role="status" className="my-4 text-sm">{message}</p>}
    {pending && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="page-action-title" className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 id="page-action-title" className="mb-3 text-xl font-semibold capitalize">{pending.action} pages</h2>
        <p>{pending.scope.pages} pages · {pending.scope.rows} locale rows · {pending.scope.children} included child pages</p>
        <ul className="my-3 list-inside list-disc">{pending.scope.titles.map((title, index) => <li key={index}>{title}</li>)}</ul>
        {pending.scope.skipped.length > 0 && <p>Skipped rows: {pending.scope.skipped.map(row => `${row.slug} (${row.locale}: ${row.reason})`).join(", ")}</p>}
        {pending.action === "restore" && <p>Each page returns to its previous published or draft state.</p>}
        <p className="my-3 text-sm text-gray-600">Changes apply on the next origin request. External indexes and caches may take up to 1 hour.</p>
        {needsWord && <label className="my-4 block">Type DELETE to confirm<input autoFocus value={typed} onChange={event => setTyped(event.target.value)} className="mt-1 block w-full rounded border p-2" /></label>}
        <div className="mt-4 flex gap-3"><button type="button" disabled={busy || (!!needsWord && typed !== "DELETE")} onClick={confirmAction} className="rounded bg-black px-4 py-2 text-white disabled:opacity-40">Confirm {pending.action}</button>
          <button type="button" disabled={busy} onClick={() => setPending(null)} className="rounded border px-4 py-2">Cancel</button></div>
      </div>
    </div>}
  </>;
}
