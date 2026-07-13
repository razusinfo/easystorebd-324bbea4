import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listOAuthTroubleshoot } from "@/lib/oauth-error-log.functions";

export const Route = createFileRoute("/_authenticated/admin-oauth-troubleshoot")({
  component: AdminOAuthTroubleshoot,
});

function AdminOAuthTroubleshoot() {
  const fn = useServerFn(listOAuthTroubleshoot);
  const q = useQuery({
    queryKey: ["oauth-troubleshoot"],
    queryFn: () => fn(),
    refetchInterval: 15_000,
  });

  if (q.isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (q.error) return <div className="p-6 text-sm text-red-600">{(q.error as Error).message}</div>;

  const errors = q.data?.errors ?? [];
  const domains = q.data?.domains ?? [];
  const audit = q.data?.audit ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-semibold">OAuth Troubleshooting</h1>
        <p className="text-sm text-muted-foreground">
          Recent Google sign-in failures on reseller subdomains, plus DNS/SSL status.
        </p>
      </header>

      <section className="rounded-xl border">
        <h2 className="border-b px-4 py-2 text-sm font-semibold">Recent OAuth errors ({errors.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Host</th>
                <th className="px-3 py-2 text-left">Slug</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">redirect_uri</th>
                <th className="px-3 py-2 text-left">Message</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="whitespace-nowrap px-3 py-1.5">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-3 py-1.5 font-mono">{r.host ?? "-"}</td>
                  <td className="px-3 py-1.5">{r.tenant_slug ?? "-"}</td>
                  <td className="px-3 py-1.5">{r.status_hint ?? "-"}</td>
                  <td className="px-3 py-1.5 font-mono">{r.redirect_uri ?? "-"}</td>
                  <td className="px-3 py-1.5">{r.message ?? "-"}</td>
                </tr>
              ))}
              {errors.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">No errors logged.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border">
          <h2 className="border-b px-4 py-2 text-sm font-semibold">Custom domain status ({domains.length})</h2>
          <ul className="divide-y text-xs">
            {domains.map((d) => (
              <li key={d.domain} className="flex items-center justify-between px-3 py-1.5">
                <span className="font-mono">{d.domain}</span>
                <span className={d.status === "active" ? "text-emerald-600" : "text-amber-600"}>{d.status}</span>
              </li>
            ))}
            {domains.length === 0 && <li className="px-3 py-4 text-center text-muted-foreground">None</li>}
          </ul>
        </div>

        <div className="rounded-xl border">
          <h2 className="border-b px-4 py-2 text-sm font-semibold">Unknown-tenant hits ({audit.length})</h2>
          <ul className="divide-y text-xs">
            {audit.map((a) => (
              <li key={a.host} className="px-3 py-1.5">
                <div className="flex justify-between font-mono"><span>{a.host}</span><span className="text-muted-foreground">×{a.hit_count}</span></div>
                <div className="text-muted-foreground">{a.kind} · {a.attempted ?? "-"} · {new Date(a.last_seen).toLocaleString()}</div>
              </li>
            ))}
            {audit.length === 0 && <li className="px-3 py-4 text-center text-muted-foreground">None</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}
