import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, RefreshCcw, Trash2, Plus } from "lucide-react";

import {
  listResellerSyncStatus,
  retryImageRehost,
  listCategoryMappings,
  saveCategoryMapping,
  deleteCategoryMapping,
} from "@/lib/reseller-sync-admin.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin-reseller-sync-status")({
  head: () => ({
    meta: [{ title: "Reseller Sync Status" }],
  }),
  component: AdminResellerSyncStatusPage,
});

type MappingRow = {
  id: string;
  source: string | null;
  payload_path: string | null;
  fallback_value: string | null;
  priority: number;
  notes: string | null;
};

function AdminResellerSyncStatusPage() {
  const [filter, setFilter] = useState<"all" | "failed" | "no_category">("all");

  const listStatusFn = useServerFn(listResellerSyncStatus);
  const listMappingsFn = useServerFn(listCategoryMappings);
  const retryFn = useServerFn(retryImageRehost);
  const qc = useQueryClient();

  const statusQ = useQuery({
    queryKey: ["reseller-sync-status"],
    queryFn: () => listStatusFn(),
  });
  const mappingsQ = useQuery({
    queryKey: ["reseller-category-mappings"],
    queryFn: () => listMappingsFn(),
  });

  const retry = useMutation({
    mutationFn: (id: string) => retryFn({ data: { reseller_product_id: id } }),
    onSuccess: (res) => {
      if (res.status === "ok") toast.success("Image resynced");
      else toast.error(`Retry ${res.status}: ${res.error ?? "failed"}`);
      qc.invalidateQueries({ queryKey: ["reseller-sync-status"] });
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const rows = (statusQ.data ?? []).filter((r) => {
    if (filter === "failed") return r.image_sync_status === "failed";
    if (filter === "no_category") return !r.category;
    return true;
  });

  const failedCount = (statusQ.data ?? []).filter((r) => r.image_sync_status === "failed").length;
  const noCatCount = (statusQ.data ?? []).filter((r) => !r.category).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Reseller Sync Status</h1>
        <p className="text-sm text-muted-foreground">
          Per-product image sync outcomes and missing-category diagnostics.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total products" value={statusQ.data?.length ?? 0} />
        <StatCard label="Image sync failed" value={failedCount} tone="danger" />
        <StatCard label="Missing category" value={noCatCount} tone="warn" />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Products</CardTitle>
          <div className="flex gap-2">
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>All</FilterButton>
            <FilterButton active={filter === "failed"} onClick={() => setFilter("failed")}>Image failed</FilterButton>
            <FilterButton active={filter === "no_category"} onClick={() => setFilter("no_category")}>No category</FilterButton>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {statusQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing matches this filter.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Image sync</TableHead>
                  <TableHead>Last attempt</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {r.image_url ? (
                          <img
                            src={r.image_url}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-md object-cover ring-1 ring-border"
                            onError={(e) => ((e.currentTarget.style.visibility = "hidden"))}
                          />
                        ) : (
                          <div className="h-10 w-10 shrink-0 rounded-md bg-muted" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium">{r.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{r.external_id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{r.source ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {r.category ? (
                        <Badge variant="secondary">{r.category}</Badge>
                      ) : (
                        <div className="flex items-start gap-1 text-amber-600">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span className="text-xs">{r.category_missing_reason ?? "Missing"}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <SyncBadge status={r.image_sync_status} error={r.image_sync_error} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {r.image_sync_attempted_at
                        ? new Date(r.image_sync_attempted_at).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={retry.isPending && retry.variables === r.id}
                        onClick={() => retry.mutate(r.id)}
                      >
                        <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                        Retry image sync
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CategoryMappingsCard
        mappings={(mappingsQ.data ?? []) as MappingRow[]}
        loading={mappingsQ.isLoading}
        onChanged={() => qc.invalidateQueries({ queryKey: ["reseller-category-mappings"] })}
      />
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "danger" | "warn" }) {
  const color = tone === "danger" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function FilterButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <Button size="sm" variant={active ? "default" : "outline"} onClick={onClick}>
      {children}
    </Button>
  );
}

function SyncBadge({ status, error }: { status: string | null; error: string | null }) {
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
        <CheckCircle2 className="h-3.5 w-3.5" /> ok
      </span>
    );
  }
  if (status === "failed") {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 text-xs text-red-600">
          <AlertTriangle className="h-3.5 w-3.5" /> failed
        </span>
        {error ? <span className="max-w-[280px] truncate text-[10px] text-muted-foreground" title={error}>{error}</span> : null}
      </div>
    );
  }
  return <span className="text-xs text-muted-foreground">{status ?? "pending"}</span>;
}

function CategoryMappingsCard({
  mappings, loading, onChanged,
}: { mappings: MappingRow[]; loading: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState<MappingRow | null>(null);
  const [open, setOpen] = useState(false);

  const saveFn = useServerFn(saveCategoryMapping);
  const deleteFn = useServerFn(deleteCategoryMapping);

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Mapping removed"); onChanged(); },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (m: MappingRow) => { setEditing(m); setOpen(true); };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Category Mappings</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            When a supplier doesn't send a category, these mappings are tried in priority order.
            Leave supplier blank to apply to all suppliers.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Add mapping</Button>
          </DialogTrigger>
          <MappingDialog
            editing={editing}
            onSaved={() => { setOpen(false); onChanged(); }}
            saveFn={saveFn}
          />
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : mappings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No mappings configured. Products from suppliers who don't send a category will remain uncategorized.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Priority</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Payload path</TableHead>
                <TableHead>Fallback value</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.priority}</TableCell>
                  <TableCell className="text-sm">{m.source ?? <span className="text-muted-foreground">any</span>}</TableCell>
                  <TableCell className="font-mono text-xs">{m.payload_path ?? "—"}</TableCell>
                  <TableCell className="text-sm">{m.fallback_value ?? "—"}</TableCell>
                  <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">{m.notes ?? ""}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>Edit</Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => del.mutate(m.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function MappingDialog({
  editing, onSaved, saveFn,
}: {
  editing: MappingRow | null;
  onSaved: () => void;
  saveFn: (opts: { data: any }) => Promise<any>;
}) {
  const [source, setSource] = useState(editing?.source ?? "");
  const [payloadPath, setPayloadPath] = useState(editing?.payload_path ?? "");
  const [fallbackValue, setFallbackValue] = useState(editing?.fallback_value ?? "");
  const [priority, setPriority] = useState(String(editing?.priority ?? 100));
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          id: editing?.id ?? null,
          source: source.trim() || null,
          payload_path: payloadPath.trim() || null,
          fallback_value: fallbackValue.trim() || null,
          priority: Number(priority) || 100,
          notes: notes.trim() || null,
        },
      }),
    onSuccess: () => { toast.success(editing ? "Updated" : "Added"); onSaved(); },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit mapping" : "Add category mapping"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Supplier (source) — optional</Label>
          <Input placeholder="e.g. Nusrat Telecom (leave blank for all)" value={source} onChange={(e) => setSource(e.target.value)} />
        </div>
        <div>
          <Label>Payload path (dotted)</Label>
          <Input placeholder="e.g. product_type or details.main_category" value={payloadPath} onChange={(e) => setPayloadPath(e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">
            The webhook reads this path from the raw JSON payload the supplier sent.
          </p>
        </div>
        <div>
          <Label>Fallback literal value — optional</Label>
          <Input placeholder="e.g. Uncategorized" value={fallbackValue} onChange={(e) => setFallbackValue(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Priority</Label>
            <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
