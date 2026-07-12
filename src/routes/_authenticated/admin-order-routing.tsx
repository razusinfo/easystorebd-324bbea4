import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Plus, RefreshCcw, RotateCw, Search, X, Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin-order-routing")({
  component: AdminOrderRoutingPage,
});

type Rule = {
  id: string;
  supplier_user_id: string;
  scope: "unlinked_default" | "category";
  category_id: string | null;
  active: boolean;
  priority: number;
  notes: string | null;
  created_at: string;
};

type AuditRow = {
  id: string;
  source_order_id: string | null;
  source_order_item_id: string | null;
  product_id: string | null;
  reseller_product_id: string | null;
  supplier_user_id: string | null;
  routing_rule_id: string | null;
  reason: string;
  success: boolean;
  error: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const REASON_LABEL: Record<string, string> = {
  linked_source_reseller_product: "Linked → source supplier",
  unlinked_default_rule: "Unlinked → default rule",
  unlinked_category_rule: "Unlinked → category rule",
  unlinked_no_rule: "Unlinked → NO rule (dropped)",
  retry_linked_source_reseller_product: "Retry: Linked → source supplier",
  retry_unlinked_default_rule: "Retry: Unlinked → default rule",
  retry_unlinked_category_rule: "Retry: Unlinked → category rule",
  retry_unlinked_no_rule: "Retry: NO rule (dropped)",
  retry_already_forwarded: "Retry: Already forwarded",
  retry_no_product: "Retry: order_item has no product",
  retry_no_store_owner: "Retry: store has no owner",
  retry_error: "Retry: Error",
  error: "Error",
};

const REASON_FILTER_GROUPS: Array<{ value: string; label: string; match: (r: string) => boolean }> = [
  { value: "all", label: "All reasons", match: () => true },
  { value: "linked", label: "Linked", match: (r) => r.includes("linked_source_reseller_product") },
  { value: "category", label: "Category rule", match: (r) => r.includes("unlinked_category_rule") },
  { value: "default", label: "Default rule", match: (r) => r.includes("unlinked_default_rule") },
  { value: "no_rule", label: "No rule (dropped)", match: (r) => r.includes("no_rule") },
  { value: "error", label: "Error / failed", match: (r) => r === "error" || r.startsWith("retry_error") || r.includes("no_product") || r.includes("no_store_owner") },
  { value: "retry", label: "Retries only", match: (r) => r.startsWith("retry_") },
];

function AdminOrderRoutingPage() {
  const qc = useQueryClient();
  const [supplier, setSupplier] = useState("");
  const [scope, setScope] = useState<"unlinked_default" | "category">("unlinked_default");
  const [categoryId, setCategoryId] = useState<string>("");
  const [priority, setPriority] = useState<number>(100);
  const [notes, setNotes] = useState("");

  // Audit log filters
  const [fReason, setFReason] = useState<string>("all");
  const [fSupplier, setFSupplier] = useState<string>("all");
  const [fCategory, setFCategory] = useState<string>("all");
  const [fFrom, setFFrom] = useState<string>("");
  const [fTo, setFTo] = useState<string>("");
  const [fQuery, setFQuery] = useState<string>("");
  const [fFailedOnly, setFFailedOnly] = useState<boolean>(false);
  const [detailRow, setDetailRow] = useState<AuditRow | null>(null);



  const users = useQuery({
    queryKey: ["admin_list_users_min"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      return (data ?? []) as Array<{ user_id: string; email: string; full_name: string; roles: string[] }>;
    },
  });

  const categories = useQuery({
    queryKey: ["product_categories_routing"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_categories").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rules = useQuery({
    queryKey: ["order_routing_rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_routing_rules")
        .select("*")
        .order("scope", { ascending: true })
        .order("priority", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Rule[];
    },
  });

  const audit = useQuery({
    queryKey: ["reseller_order_forward_audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reseller_order_forward_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  const userLookup = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users.data ?? []) m.set(u.user_id, u.full_name || u.email);
    return m;
  }, [users.data]);

  const categoryLookup = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories.data ?? []) m.set(c.id, c.name);
    return m;
  }, [categories.data]);

  const addRule = useMutation({
    mutationFn: async () => {
      if (!supplier) throw new Error("Supplier required");
      if (scope === "category" && !categoryId) throw new Error("Category required for category-scoped rule");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("order_routing_rules").insert({
        supplier_user_id: supplier,
        scope,
        category_id: scope === "category" ? categoryId : null,
        priority,
        notes: notes || null,
        active: true,
        created_by: u.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Routing rule added");
      setSupplier(""); setCategoryId(""); setNotes(""); setPriority(100); setScope("unlinked_default");
      qc.invalidateQueries({ queryKey: ["order_routing_rules"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to add rule"),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("order_routing_rules").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order_routing_rules"] }),
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("order_routing_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rule removed");
      qc.invalidateQueries({ queryKey: ["order_routing_rules"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const retryForward = useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase.rpc("retry_forward_order_item", { _item_id: itemId });
      if (error) throw error;
      return data as { ok: boolean; error?: string; reason?: string; reseller_order_id?: string; already?: boolean };
    },
    onSuccess: (res) => {
      if (res?.ok) {
        toast.success(res.already ? "Already forwarded" : `Forwarded (${res.reason ?? "ok"})`);
      } else {
        toast.error(`Retry failed: ${res?.error ?? "unknown"}`);
      }
      qc.invalidateQueries({ queryKey: ["reseller_order_forward_audit"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Retry failed"),
  });

  // Client-side filter over the loaded audit rows.
  const filteredAudit = useMemo(() => {
    const rows = audit.data ?? [];
    const q = fQuery.trim().toLowerCase();
    const fromTs = fFrom ? new Date(fFrom).getTime() : null;
    const toTs = fTo ? new Date(fTo).getTime() + 86400000 : null; // inclusive end-of-day
    const group = REASON_FILTER_GROUPS.find((g) => g.value === fReason) ?? REASON_FILTER_GROUPS[0];
    return rows.filter((a) => {
      if (fFailedOnly && a.success) return false;
      if (!group.match(a.reason)) return false;

      if (fSupplier !== "all" && a.supplier_user_id !== fSupplier) return false;
      if (fCategory !== "all") {
        // Try both product's category (via metadata) and audit's product_id lookup via categoryLookup unavailable client-side without join.
        const catInMeta = (a.metadata as any)?.category_id;
        if (catInMeta !== fCategory) return false;
      }
      const ts = new Date(a.created_at).getTime();
      if (fromTs && ts < fromTs) return false;
      if (toTs && ts > toTs) return false;
      if (q) {
        const hay = [
          a.reason,
          a.error ?? "",
          a.source_order_id ?? "",
          a.source_order_item_id ?? "",
          a.product_id ?? "",
          a.reseller_product_id ?? "",
          a.supplier_user_id ?? "",
          (a.metadata as any)?.product_name ?? "",
          (a.metadata as any)?.reseller_order_id ?? "",
          JSON.stringify(a.metadata ?? {}),
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [audit.data, fReason, fSupplier, fCategory, fFrom, fTo, fQuery, fFailedOnly]);

  const errorCount = useMemo(
    () => (audit.data ?? []).filter((a) => !a.success).length,
    [audit.data],
  );

  function resetFilters() {
    setFReason("all"); setFSupplier("all"); setFCategory("all");
    setFFrom(""); setFTo(""); setFQuery(""); setFFailedOnly(false);
  }


  return (
    <div className="p-4 sm:p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Order Routing</h1>
        <p className="text-sm text-muted-foreground">
          Decide which supplier receives customer orders when a product isn't directly linked to a
          marketplace item. Rules apply in priority order — lower priority number wins. Category
          rules take precedence over the default rule.
        </p>
      </header>

      {/* Add rule */}
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">Add routing rule</h2>
        <div className="grid gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Supplier</label>
            <Select value={supplier} onValueChange={setSupplier}>
              <SelectTrigger><SelectValue placeholder="Choose supplier user" /></SelectTrigger>
              <SelectContent>
                {(users.data ?? []).map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {u.full_name || u.email} <span className="opacity-60 ml-1 text-[10px]">{u.roles?.join(",")}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Scope</label>
            <Select value={scope} onValueChange={(v: any) => setScope(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unlinked_default">Unlinked default</SelectItem>
                <SelectItem value="category">Category</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Category</label>
            <Select
              value={categoryId}
              onValueChange={setCategoryId}
              disabled={scope !== "category"}
            >
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {(categories.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Priority</label>
            <Input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value) || 100)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Notes</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div>
          <Button onClick={() => addRule.mutate()} disabled={addRule.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Add rule
          </Button>
        </div>
      </Card>

      {/* Rules table */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-3">
          <h2 className="font-semibold">Active rules ({rules.data?.length ?? 0})</h2>
          <Button variant="outline" size="sm" onClick={() => rules.refetch()}>
            <RefreshCcw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Priority</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.data?.length ? rules.data.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  {userLookup.get(r.supplier_user_id) ?? r.supplier_user_id.slice(0, 8)}
                </TableCell>
                <TableCell><Badge variant="secondary">{r.scope}</Badge></TableCell>
                <TableCell>{r.category_id ? categoryLookup.get(r.category_id) ?? r.category_id.slice(0, 8) : "—"}</TableCell>
                <TableCell className="text-right">{r.priority}</TableCell>
                <TableCell>
                  <Switch
                    checked={r.active}
                    onCheckedChange={(v) => toggleActive.mutate({ id: r.id, active: v })}
                  />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{r.notes}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => {
                    if (confirm("Delete this routing rule?")) deleteRule.mutate(r.id);
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No routing rules yet. Unlinked orders will not be forwarded until a rule is added.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Audit log */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Forwarding audit log</h2>
            <Badge variant="secondary">{filteredAudit.length} / {audit.data?.length ?? 0}</Badge>
            {errorCount > 0 && (
              <Badge variant="destructive">{errorCount} failed</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={fFailedOnly ? "destructive" : "outline"}
              size="sm"
              onClick={() => setFFailedOnly((v) => !v)}
              title="Show only failed forwarding attempts"
            >
              {fFailedOnly ? "Showing failed only" : "Failed only"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => audit.refetch()}>
              <RefreshCcw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>

        </div>

        {/* Filters */}
        <div className="grid gap-2 px-3 pb-3 md:grid-cols-6">
          <div className="md:col-span-2 relative">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input
              value={fQuery}
              onChange={(e) => setFQuery(e.target.value)}
              placeholder="Search reason, error, order id, item id, product…"
              className="pl-8"
            />
          </div>
          <Select value={fReason} onValueChange={setFReason}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {REASON_FILTER_GROUPS.map((g) => (
                <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fSupplier} onValueChange={setFSupplier}>
            <SelectTrigger><SelectValue placeholder="Supplier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All suppliers</SelectItem>
              {(users.data ?? []).map((u) => (
                <SelectItem key={u.user_id} value={u.user_id}>
                  {u.full_name || u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fCategory} onValueChange={setFCategory}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(categories.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} title="From" />
            <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} title="To" />
          </div>
          <div className="md:col-span-6 flex justify-end">
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="h-4 w-4 mr-1" /> Reset filters
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Source order / item</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Success</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAudit.length ? filteredAudit.map((a) => {

              const meta = (a.metadata ?? {}) as any;
              const isError = !a.success;
              const canRetry = !!a.source_order_item_id;
              return (
                <TableRow key={a.id} className={isError ? "bg-destructive/5" : ""}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={a.success ? "secondary" : "destructive"}>
                      {REASON_LABEL[a.reason] ?? a.reason}
                    </Badge>
                    {isError && a.error && (
                      <div className="text-[10px] text-destructive mt-1 max-w-[240px] truncate" title={a.error}>
                        {a.error}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {a.supplier_user_id ? (userLookup.get(a.supplier_user_id) ?? a.supplier_user_id.slice(0, 8)) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {meta.product_name ?? a.product_id?.slice(0, 8) ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div>ord {a.source_order_id?.slice(0, 8) ?? "—"}</div>
                    <div className="opacity-70">itm {a.source_order_item_id?.slice(0, 8) ?? "—"}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {meta.reseller_order_id
                      ? <span title={String(meta.reseller_order_id)}>ro {String(meta.reseller_order_id).slice(0, 8)}</span>
                      : "—"}
                  </TableCell>
                  <TableCell>{a.success ? "✓" : "✗"}</TableCell>

                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDetailRow(a)}
                        title="View details"
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                      {canRetry && (
                        <Button
                          variant={isError ? "default" : "outline"}
                          size="sm"
                          disabled={retryForward.isPending}
                          onClick={() => {
                            if (confirm("Re-run forwarding for this order item?")) {
                              retryForward.mutate(a.source_order_item_id!);
                            }
                          }}
                        >
                          <RotateCw className={`h-4 w-4 mr-1 ${retryForward.isPending ? "animate-spin" : ""}`} />
                          Retry
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            }) : (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  {audit.isLoading ? "Loading…" : "No forwarding events match the current filters."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {detailRow ? (REASON_LABEL[detailRow.reason] ?? detailRow.reason) : ""}
            </DialogTitle>
            <DialogDescription>
              {detailRow?.success ? "Forwarding succeeded." : "Forwarding failed — see details below."}
            </DialogDescription>
          </DialogHeader>
          {detailRow && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Field label="When" value={new Date(detailRow.created_at).toLocaleString()} />
                <Field label="Reason code" value={detailRow.reason} mono />
                <Field
                  label="Supplier"
                  value={detailRow.supplier_user_id
                    ? `${userLookup.get(detailRow.supplier_user_id) ?? ""} (${detailRow.supplier_user_id.slice(0, 8)})`
                    : "—"}
                />
                <Field label="Routing rule id" value={detailRow.routing_rule_id ?? "—"} mono />
                <Field label="Source order id" value={detailRow.source_order_id ?? "—"} mono />
                <Field label="Source order item id" value={detailRow.source_order_item_id ?? "—"} mono />
                <Field label="Product id" value={detailRow.product_id ?? "—"} mono />
                <Field label="Reseller product id" value={detailRow.reseller_product_id ?? "—"} mono />
                <Field
                  label="Reseller order created"
                  value={(detailRow.metadata as any)?.reseller_order_id ?? "—"}
                  mono
                />
                <Field
                  label="Conflict / already forwarded"
                  value={detailRow.reason.includes("already_forwarded") ? "yes" : "no"}
                />
              </div>
              {detailRow.error && (
                <div className="rounded border border-destructive/40 bg-destructive/5 p-2">
                  <div className="text-xs font-semibold text-destructive">Error</div>
                  <div className="text-xs whitespace-pre-wrap break-words">{detailRow.error}</div>
                </div>
              )}
              <div>
                <div className="text-xs font-semibold mb-1">Full metadata</div>
                <pre className="text-[11px] bg-muted p-2 rounded overflow-auto max-h-64">
{JSON.stringify(detailRow.metadata ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
          <DialogFooter>
            {detailRow?.source_order_item_id && (
              <Button
                onClick={() => {
                  retryForward.mutate(detailRow.source_order_item_id!);
                  setDetailRow(null);
                }}
                disabled={retryForward.isPending}
              >
                <RotateCw className="h-4 w-4 mr-1" /> Retry forwarding
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xs ${mono ? "font-mono break-all" : ""}`}>{value}</div>
    </div>
  );
}
