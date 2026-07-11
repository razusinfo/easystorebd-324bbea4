import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  debugResolveTenant,
  listTenantAudit,
  getUnknownRedirectSetting,
  setUnknownRedirectSetting,
} from "@/lib/tenant-resolver.functions";

export const Route = createFileRoute("/_authenticated/admin-tenant-debug")({
  component: AdminTenantDebug,
});

function AdminTenantDebug() {
  const qc = useQueryClient();
  const debugFn = useServerFn(debugResolveTenant);
  const auditFn = useServerFn(listTenantAudit);
  const getFlag = useServerFn(getUnknownRedirectSetting);
  const setFlag = useServerFn(setUnknownRedirectSetting);

  const [host, setHost] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);

  const audit = useQuery({ queryKey: ["tenant-audit"], queryFn: () => auditFn() });
  const flag = useQuery({ queryKey: ["unknown-redirect"], queryFn: () => getFlag() });

  const toggle = useMutation({
    mutationFn: (redirect: boolean) => setFlag({ data: { redirect } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["unknown-redirect"] }),
  });

  async function onResolve(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setResult(null);
    try {
      const r = await debugFn({ data: { host } });
      setResult(r);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-bold">Tenant Debug</h1>
        <p className="text-sm text-muted-foreground">Resolve any host and inspect repeated unknown-subdomain hits.</p>
      </header>

      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">Unknown-tenant behavior</h2>
        <div className="mt-2 flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(flag.data?.redirect)}
              disabled={flag.isLoading || toggle.isPending}
              onChange={(e) => toggle.mutate(e.target.checked)}
            />
            Hard-redirect unknown subdomains to easystorebd.com
          </label>
          {toggle.isPending && <span className="text-xs text-muted-foreground">Saving…</span>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          When off, unknown hosts render the branded 404 fallback page.
        </p>
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">Resolve a host</h2>
        <form onSubmit={onResolve} className="mt-3 flex gap-2">
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="e.g. sylhetionlineshop.easystorebd.com"
            className="flex-1 rounded-md border px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Resolve
          </button>
        </form>
        {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
        {result != null && (
          <pre className="mt-3 overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </section>

      <section className="rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Unknown-tenant hits</h2>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["tenant-audit"] })}
            className="rounded-md border px-3 py-1 text-xs"
          >
            Refresh
          </button>
        </div>
        <div className="mt-3 overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2">Host</th>
                <th>Kind</th>
                <th>Attempted</th>
                <th className="text-right">Hits</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {(audit.data?.rows ?? []).map((r) => (
                <tr key={r.host} className="border-t">
                  <td className="py-2 font-mono">{r.host}</td>
                  <td>{r.kind}</td>
                  <td className="font-mono text-xs">{r.attempted ?? "—"}</td>
                  <td className="text-right tabular-nums">{r.hit_count}</td>
                  <td className="text-xs text-muted-foreground">{new Date(r.last_seen).toLocaleString()}</td>
                </tr>
              ))}
              {audit.data && audit.data.rows.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">No unknown-tenant hits recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
