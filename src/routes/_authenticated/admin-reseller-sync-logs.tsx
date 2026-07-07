import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const listLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("reseller_sync_webhook_logs")
      .select("id, received_at, source_ip, secret_valid, http_status, external_id, source, error, payload")
      .order("received_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const Route = createFileRoute("/_authenticated/admin-reseller-sync-logs")({
  errorComponent: ({ error }) => (
    <div className="p-6 text-destructive" role="alert">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Not found.</div>,
  component: LogsPage,
});

function LogsPage() {
  const fn = useServerFn(listLogs);
  const q = useQuery({ queryKey: ["reseller-sync-logs"], queryFn: () => fn() });
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-3">
      <h1 className="text-2xl font-bold">Reseller Sync Webhook Logs</h1>
      {q.isLoading && <p className="text-muted-foreground">Loading…</p>}
      {q.error && <p className="text-destructive">{(q.error as Error).message}</p>}
      {q.data?.length === 0 && <p className="text-muted-foreground">No webhook calls received yet.</p>}
      {q.data?.map((row) => {
        const ok = row.http_status >= 200 && row.http_status < 300;
        return (
          <Card key={row.id} className="p-3 text-sm space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={ok ? "default" : "destructive"}>HTTP {row.http_status}</Badge>
              {!row.secret_valid && <Badge variant="destructive">Invalid secret</Badge>}
              <span className="text-muted-foreground">{new Date(row.received_at).toLocaleString()}</span>
              {row.external_id && <span className="font-mono text-xs">{row.external_id}</span>}
              {row.source && <Badge variant="secondary">{row.source}</Badge>}
              {row.source_ip && <span className="text-xs text-muted-foreground">{row.source_ip}</span>}
            </div>
            {row.error && <p className="text-destructive break-words">{row.error}</p>}
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Payload</summary>
              <pre className="mt-1 p-2 bg-muted rounded overflow-auto max-h-64">
                {JSON.stringify(row.payload, null, 2)}
              </pre>
            </details>
          </Card>
        );
      })}
    </div>
  );
}
