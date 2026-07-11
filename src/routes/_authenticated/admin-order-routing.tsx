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
  error: "Error",
};

function AdminOrderRoutingPage() {
  const qc = useQueryClient();
  const [supplier, setSupplier] = useState("");
  const [scope, setScope] = useState<"unlinked_default" | "category">("unlinked_default");
  const [categoryId, setCategoryId] = useState<string>("");
  const [priority, setPriority] = useState<number>(100);
  const [notes, setNotes] = useState("");

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
        <div className="flex items-center justify-between p-3">
          <h2 className="font-semibold">Forwarding audit log (last 200)</h2>
          <Button variant="outline" size="sm" onClick={() => audit.refetch()}>
            <RefreshCcw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Success</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {audit.data?.length ? audit.data.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="text-xs whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant={a.success ? "secondary" : "destructive"}>
                    {REASON_LABEL[a.reason] ?? a.reason}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {a.supplier_user_id ? (userLookup.get(a.supplier_user_id) ?? a.supplier_user_id.slice(0, 8)) : "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {(a.metadata as any)?.product_name ?? a.product_id?.slice(0, 8) ?? "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{a.source_order_id?.slice(0, 8) ?? "—"}</TableCell>
                <TableCell>{a.success ? "✓" : "✗"}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">
                  {a.error ?? JSON.stringify(a.metadata ?? {})}
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  {audit.isLoading ? "Loading…" : "No forwarding events yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
