import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { useEffect, useState } from "react";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type LogRow = {
  id: string;
  received_at: string;
  source_ip: string | null;
  secret_valid: boolean;
  http_status: number;
  external_id: string | null;
  source: string | null;
  error: string | null;
  payload: JsonValue;
};

const filtersSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(200).default(25),
  status: z.enum(["all", "2xx", "4xx", "5xx"]).default("all"),
  secretValid: z.enum(["all", "valid", "invalid"]).default("all"),
  source: z.string().trim().max(100).optional().nullable(),
  from: z.string().optional().nullable(),
  to: z.string().optional().nullable(),
});
type Filters = z.infer<typeof filtersSchema>;

async function assertAdmin(ctx: { supabase: typeof supabase; userId: string }) {
  const { data: isAdmin } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "super_admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

function applyFilters(qb: any, f: Filters) {
  if (f.status === "2xx") qb = qb.gte("http_status", 200).lt("http_status", 300);
  else if (f.status === "4xx") qb = qb.gte("http_status", 400).lt("http_status", 500);
  else if (f.status === "5xx") qb = qb.gte("http_status", 500).lt("http_status", 600);
  if (f.secretValid === "valid") qb = qb.eq("secret_valid", true);
  if (f.secretValid === "invalid") qb = qb.eq("secret_valid", false);
  if (f.source) qb = qb.eq("source", f.source);
  if (f.from) qb = qb.gte("received_at", new Date(f.from).toISOString());
  if (f.to) qb = qb.lte("received_at", new Date(f.to).toISOString());
  return qb;
}

const listLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => filtersSchema.parse(data))
  .handler(async ({ data: f, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const from = (f.page - 1) * f.limit;
    const to = from + f.limit - 1;
    let qb = supabaseAdmin
      .from("reseller_sync_webhook_logs")
      .select(
        "id, received_at, source_ip, secret_valid, http_status, external_id, source, error, payload",
        { count: "exact" },
      )
      .order("received_at", { ascending: false })
      .range(from, to);
    qb = applyFilters(qb, f);
    const { data, error, count } = await qb;
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as LogRow[], total: count ?? 0 };
  });

const exportLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => filtersSchema.parse(data))
  .handler(async ({ data: f, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let qb = supabaseAdmin
      .from("reseller_sync_webhook_logs")
      .select(
        "id, received_at, source_ip, secret_valid, http_status, external_id, source, error, payload",
      )
      .order("received_at", { ascending: false })
      .limit(10000);
    qb = applyFilters(qb, f);
    const { data, error } = await qb;
    if (error) throw new Error(error.message);
    return (data ?? []) as LogRow[];
  });

const listSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("reseller_sync_webhook_logs")
      .select("source")
      .not("source", "is", null)
      .limit(1000);
    if (error) throw new Error(error.message);
    return Array.from(new Set((data ?? []).map((r: { source: string | null }) => r.source).filter(Boolean))) as string[];
  });

export const Route = createFileRoute("/_authenticated/admin-reseller-sync-logs")({
  errorComponent: ({ error }) => (
    <div className="p-6 text-destructive" role="alert">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Not found.</div>,
  component: LogsPage,
});

function toCsv(rows: LogRow[]): string {
  const headers = [
    "id","received_at","source_ip","secret_valid","http_status","external_id","source","error","payload",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([r.id, r.received_at, r.source_ip, r.secret_valid, r.http_status, r.external_id, r.source, r.error, r.payload].map(esc).join(","));
  }
  return lines.join("\n");
}

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function LogsPage() {
  const listFn = useServerFn(listLogs);
  const exportFn = useServerFn(exportLogs);
  const sourcesFn = useServerFn(listSources);
  const qc = useQueryClient();

  const [filters, setFilters] = useState<Filters>({
    page: 1, limit: 25, status: "all", secretValid: "all",
    source: null, from: null, to: null,
  });

  const q = useQuery({
    queryKey: ["reseller-sync-logs", filters],
    queryFn: () => listFn({ data: filters }),
    placeholderData: (prev) => prev,
  });

  const sourcesQ = useQuery({
    queryKey: ["reseller-sync-log-sources"],
    queryFn: () => sourcesFn(),
  });

  // Realtime: refetch on new inserts.
  useEffect(() => {
    const ch = supabase
      .channel("reseller-sync-logs-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reseller_sync_webhook_logs" },
        () => {
          qc.invalidateQueries({ queryKey: ["reseller-sync-logs"] });
          qc.invalidateQueries({ queryKey: ["reseller-sync-log-sources"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const patch = (p: Partial<Filters>) => setFilters((f) => ({ ...f, page: 1, ...p }));
  const total = q.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / filters.limit));

  const handleExport = async (fmt: "csv" | "json") => {
    const rows = await exportFn({ data: filters });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    if (fmt === "csv") download(`reseller-sync-logs-${stamp}.csv`, toCsv(rows), "text/csv");
    else download(`reseller-sync-logs-${stamp}.json`, JSON.stringify(rows, null, 2), "application/json");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">Reseller Sync Webhook Logs</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>Export CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("json")}>Export JSON</Button>
        </div>
      </div>

      <Card className="p-3 grid gap-3 md:grid-cols-6">
        <div className="space-y-1">
          <Label>HTTP</Label>
          <Select value={filters.status} onValueChange={(v) => patch({ status: v as Filters["status"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="2xx">2xx success</SelectItem>
              <SelectItem value="4xx">4xx client</SelectItem>
              <SelectItem value="5xx">5xx server</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Secret</Label>
          <Select value={filters.secretValid} onValueChange={(v) => patch({ secretValid: v as Filters["secretValid"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="valid">Valid</SelectItem>
              <SelectItem value="invalid">Invalid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Source</Label>
          <Select
            value={filters.source ?? "all"}
            onValueChange={(v) => patch({ source: v === "all" ? null : v })}
          >
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {(sourcesQ.data ?? []).map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>From</Label>
          <Input type="datetime-local" value={filters.from ?? ""} onChange={(e) => patch({ from: e.target.value || null })} />
        </div>
        <div className="space-y-1">
          <Label>To</Label>
          <Input type="datetime-local" value={filters.to ?? ""} onChange={(e) => patch({ to: e.target.value || null })} />
        </div>
        <div className="space-y-1">
          <Label>Per page</Label>
          <Select value={String(filters.limit)} onValueChange={(v) => patch({ limit: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100, 200].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {q.isLoading && <p className="text-muted-foreground">Loading…</p>}
      {q.error && <p className="text-destructive">{(q.error as Error).message}</p>}
      {q.data && q.data.rows.length === 0 && (
        <p className="text-muted-foreground">No logs match these filters.</p>
      )}

      {q.data?.rows.map((row) => {
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

      <div className="flex items-center justify-between gap-2 pt-2">
        <span className="text-sm text-muted-foreground">
          {total.toLocaleString()} total · page {filters.page} / {pages}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={filters.page <= 1}
            onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>Prev</Button>
          <Button variant="outline" size="sm" disabled={filters.page >= pages}
            onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>Next</Button>
        </div>
      </div>
    </div>
  );
}
