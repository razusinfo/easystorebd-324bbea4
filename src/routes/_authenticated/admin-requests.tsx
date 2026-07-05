import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Check, X, ImageIcon, ShieldAlert, Search, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/lib/eazystore-data";
import { approveProductRequest, rejectProductRequest, adminUpdateProductRequest, adminRepairApprovedStock, IMAGE_URL_RE, MAX_IMAGES } from "@/lib/product-requests.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MarketplaceStockReconciliationCard } from "@/components/admin/marketplace-stock-reconciliation-card";

export const Route = createFileRoute("/_authenticated/admin-requests")({
  component: AdminRequestsPage,
});

type RequestRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  images: string[] | null;
  status: string;
  requested_by: string;
  created_at: string;
  reseller_price: number | null;
};

function RepairStockButton() {
  const repairFn = useServerFn(adminRepairApprovedStock);
  const m = useMutation({
    mutationFn: () => repairFn({ data: {} }),
    onSuccess: (r: { repaired: number; checked: number }) => {
      toast.success(`Stock repair: ${r.repaired} fixed of ${r.checked} approved items checked.`);
    },
    onError: (e: Error) => toast.error(e.message || "Repair failed"),
  });
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={m.isPending}
      onClick={() => {
        if (confirm("Backfill stock to 100 for approved reseller products currently stuck at 0?")) m.mutate();
      }}
    >
      {m.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
      Repair Stock
    </Button>
  );
}

function AdminRequestsPage() {

  const isAdmin = useIsSuperAdmin();

  if (isAdmin.isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (!isAdmin.data) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" /> Super admin only
            </CardTitle>
            <CardDescription>You don't have access to this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return <AdminRequestsList />;
}

const PAGE_SIZE = 10;

function AdminRequestsList() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // Debounce search input.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);
  // Reset to first page when filters change.
  const resetPage = () => setPage(0);

  const q = useQuery({
    queryKey: ["admin-product-requests", filter, search, page],
    queryFn: async () => {
      let query = supabase
        .from("product_requests")
        .select(
          "id, name, description, price, category, images, status, requested_by, created_at, reseller_price",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (filter !== "all") query = query.eq("status", filter);
      if (search) query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%,description.ilike.%${search}%`);
      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as RequestRow[], total: count ?? 0 };
    },
  });

  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const ids = Array.from(new Set(rows.map((r) => r.requested_by)));
  const profiles = useQuery({
    queryKey: ["admin-request-profiles", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, name").in("id", ids);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.name as string]));
    },
  });

  // Distinct categories currently used in the reseller marketplace, for the
  // category selector in the Approve dialog.
  const categoriesQ = useQuery({
    queryKey: ["reseller-product-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reseller_products").select("category");
      if (error) throw error;
      const set = new Set<string>();
      for (const r of (data ?? []) as { category: string | null }[]) {
        if (r.category && r.category.trim()) set.add(r.category.trim());
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    },
  });
  const existingCategories = categoriesQ.data ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-product-requests"] });
    qc.invalidateQueries({ queryKey: ["pending-product-requests"] });
  };

  // Bulk selection (pending only).
  const approveFn = useServerFn(approveProductRequest);
  const rejectFn = useServerFn(rejectProductRequest);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => { setSelected(new Set()); }, [filter, search, page]);
  const pendingRows = useMemo(() => rows.filter((r) => r.status === "pending"), [rows]);
  const allSelected = pendingRows.length > 0 && pendingRows.every((r) => selected.has(r.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(pendingRows.map((r) => r.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const runBulk = async (action: "approve" | "reject") => {
    const targets = pendingRows.filter((r) => selected.has(r.id));
    if (targets.length === 0) return;
    let ok = 0, fail = 0;
    for (const r of targets) {
      try {
        if (action === "approve") {
          await approveFn({ data: { request_id: r.id, reseller_price: Number(r.price), admin_notes: null } });
        } else {
          await rejectFn({ data: { request_id: r.id, admin_notes: null } });
        }
        ok++;
      } catch (e) {
        fail++;
        console.warn("[bulk]", (e as Error).message);
      }
    }
    toast[fail === 0 ? "success" : "error"](
      `Bulk ${action}: ${ok} succeeded${fail ? `, ${fail} failed` : ""}.`
    );
    setSelected(new Set());
    refresh();
  };
  const bulkApprove = useMutation({ mutationFn: () => runBulk("approve") });
  const bulkReject = useMutation({ mutationFn: () => runBulk("reject") });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Request Review</h1>
          <p className="text-sm text-muted-foreground">Approve or reject reseller product submissions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => { setFilter(f); resetPage(); }}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
          <RepairStockButton />
        </div>

      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => { setSearchInput(e.target.value); resetPage(); }}
          placeholder="Search name, category, description…"
          className="pl-8"
        />
      </div>

      {q.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No {filter === "all" ? "" : filter} requests{search ? ` matching "${search}"` : ""}.
          </CardContent>
        </Card>
      ) : (
        <>
          {pendingRows.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 p-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                <span>
                  {selected.size > 0
                    ? `${selected.size} selected`
                    : `Select all pending on this page (${pendingRows.length})`}
                </span>
              </label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={selected.size === 0 || bulkApprove.isPending || bulkReject.isPending}
                  onClick={() => {
                    if (confirm(`Approve ${selected.size} request(s) at their submitted price?`)) bulkApprove.mutate();
                  }}
                >
                  {bulkApprove.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                  Bulk Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={selected.size === 0 || bulkApprove.isPending || bulkReject.isPending}
                  onClick={() => {
                    if (confirm(`Reject ${selected.size} request(s)?`)) bulkReject.mutate();
                  }}
                >
                  {bulkReject.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <X className="mr-1.5 h-4 w-4" />}
                  Bulk Reject
                </Button>
              </div>
            </div>
          )}
          <div className="grid gap-4">
            {rows.map((r) => (
              <div key={r.id} className="flex items-start gap-2">
                {r.status === "pending" ? (
                  <div className="pt-4">
                    <Checkbox
                      checked={selected.has(r.id)}
                      onCheckedChange={() => toggleOne(r.id)}
                      aria-label={`Select ${r.name}`}
                    />
                  </div>
                ) : (
                  <div className="w-4" />
                )}
                <div className="flex-1">
                  <RequestCard
                    row={r}
                    resellerName={profiles.data?.[r.requested_by] ?? "Unknown"}
                    existingCategories={existingCategories}
                    onDone={refresh}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <span className="text-xs">Page {page + 1} / {totalPages}</span>
              <Button
                variant="outline" size="sm"
                onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
                disabled={page + 1 >= totalPages}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


function RequestCard({
  row, resellerName, existingCategories, onDone,
}: {
  row: RequestRow;
  resellerName: string;
  existingCategories: string[];
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const approveFn = useServerFn(approveProductRequest);
  const rejectFn = useServerFn(rejectProductRequest);
  const [approveOpen, setApproveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resellerPrice, setResellerPrice] = useState<string>(String(row.price));
  const [stock, setStock] = useState<string>("100");
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");

  // Category selection for Approve dialog: dropdown (existing) or "__new__".
  const NEW_KEY = "__new__";
  const initialCatKey = row.category && existingCategories.includes(row.category) ? row.category : row.category ? NEW_KEY : "";
  const [categoryKey, setCategoryKey] = useState<string>(initialCatKey);
  const [newCategory, setNewCategory] = useState<string>(row.category && !existingCategories.includes(row.category) ? row.category : "");

  const approve = useMutation({
    mutationFn: async () => {
      const p = Number(resellerPrice);
      if (!Number.isFinite(p) || p < 0) throw new Error("Enter a valid reseller price");
      const s = Number(stock);
      if (!Number.isFinite(s) || s < 0 || !Number.isInteger(s)) throw new Error("Enter a valid stock quantity");
      const cat = categoryKey === NEW_KEY ? newCategory.trim() : categoryKey || null;
      return approveFn({
        data: { request_id: row.id, reseller_price: p, admin_notes: adminNotes || null, category: cat || null, stock: s },
      });
    },
    onSuccess: () => {
      toast.success("Request approved — added to Reseller Products.");
      setApproveOpen(false);
      qc.invalidateQueries({ queryKey: ["reseller-product-categories"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: () =>
      rejectFn({ data: { request_id: row.id, admin_notes: rejectNotes || null } }),
    onSuccess: () => {
      toast.success("Request rejected.");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const first = row.images?.[0];
  const pending = row.status === "pending";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="h-32 w-32 shrink-0 overflow-hidden rounded-md border bg-muted">
            {first ? (
              <img src={first} alt={row.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ImageIcon className="h-6 w-6" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-lg font-semibold">{row.name}</h3>
                  <StatusBadge status={row.status} />
                </div>
                <div className="text-xs text-muted-foreground">
                  Submitted by <span className="font-medium text-foreground">{resellerName}</span>
                  {" · "}
                  {new Date(row.created_at).toLocaleString()}
                  {row.category ? <> · {row.category}</> : null}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">৳ {Number(row.price).toLocaleString()}</div>
                {row.reseller_price != null ? (
                  <div className="text-xs text-muted-foreground">
                    Reseller: ৳ {Number(row.reseller_price).toLocaleString()}
                  </div>
                ) : null}
              </div>
            </div>

            {row.description ? (
              <p className="text-sm text-muted-foreground">{row.description}</p>
            ) : null}

            {row.images && row.images.length > 1 ? (
              <div className="flex flex-wrap gap-2">
                {row.images.slice(1).map((u) => (
                  <img key={u} src={u} alt="" className="h-14 w-14 rounded border object-cover" />
                ))}
              </div>
            ) : null}

            {pending ? (
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" onClick={() => setApproveOpen(true)}>
                  <Check className="mr-1.5 h-4 w-4" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-1.5 h-4 w-4" /> Edit
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive">
                      <X className="mr-1.5 h-4 w-4" /> Reject
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reject this request?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This marks the request as rejected. Optionally leave a note for the reseller.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Textarea
                      placeholder="Reason (optional)"
                      value={rejectNotes}
                      onChange={(e) => setRejectNotes(e.target.value)}
                      rows={3}
                    />
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => reject.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {reject.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Reject
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : (
              <div className="pt-2 text-xs text-muted-foreground">
                Already {row.status}.{" "}
                <Link to="/reseller-products" className="underline">
                  View Reseller Products
                </Link>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve request</DialogTitle>
            <DialogDescription>
              Set the reseller price. On approval, this product is added to Reseller Products.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Base price (submitted)</Label>
              <Input value={`৳ ${Number(row.price).toLocaleString()}`} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rp">Reseller price *</Label>
              <Input
                id="rp"
                type="number"
                min="0"
                step="0.01"
                value={resellerPrice}
                onChange={(e) => setResellerPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stk">Initial stock *</Label>
              <Input
                id="stk"
                type="number"
                min="0"
                step="1"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Marketplace stock available to resellers. Defaults to 100.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="an">Admin notes (optional)</Label>
              <Textarea id="an" rows={3} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Category (Reseller Products)</Label>
              <Select value={categoryKey || undefined} onValueChange={(v) => setCategoryKey(v)}>
                <SelectTrigger>
                  <SelectValue placeholder={existingCategories.length === 0 ? "No categories yet — create one" : "Choose or create a category"} />
                </SelectTrigger>
                <SelectContent>
                  {existingCategories.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No categories yet.</div>
                  )}
                  {existingCategories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                  <SelectItem value={NEW_KEY}>+ New category…</SelectItem>
                </SelectContent>
              </Select>
              {categoryKey === NEW_KEY && (
                <Input
                  placeholder="New category name"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                />
              )}
              <p className="text-[11px] text-muted-foreground">
                Optional — controls where the product appears in Reseller Products.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button onClick={() => approve.mutate()} disabled={approve.isPending}>
              {approve.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Approve & Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditRequestDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        row={row}
        existingCategories={existingCategories}
        onSaved={() => { setEditOpen(false); onDone(); }}
      />
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary";
  return <Badge variant={variant as "default" | "destructive" | "secondary"}>{status}</Badge>;
}

function EditRequestDialog({
  open, onOpenChange, row, existingCategories, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: RequestRow;
  existingCategories: string[];
  onSaved: () => void;
}) {
  const NEW_KEY = "__new__";
  const updateFn = useServerFn(adminUpdateProductRequest);
  const [name, setName] = useState(row.name);
  const [description, setDescription] = useState(row.description ?? "");
  const [price, setPrice] = useState(String(row.price));
  const [categoryKey, setCategoryKey] = useState<string>(
    row.category && existingCategories.includes(row.category) ? row.category : row.category ? NEW_KEY : "",
  );
  const [newCategory, setNewCategory] = useState<string>(
    row.category && !existingCategories.includes(row.category) ? row.category : "",
  );
  const [images, setImages] = useState<string[]>(row.images ?? []);
  const [newImage, setNewImage] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(row.name);
    setDescription(row.description ?? "");
    setPrice(String(row.price));
    setCategoryKey(row.category && existingCategories.includes(row.category) ? row.category : row.category ? NEW_KEY : "");
    setNewCategory(row.category && !existingCategories.includes(row.category) ? row.category : "");
    setImages(row.images ?? []);
    setNewImage("");
  }, [open, row, existingCategories]);

  const addImage = () => {
    const u = newImage.trim();
    if (!u) return;
    if (!IMAGE_URL_RE.test(u)) { toast.error("Must be an http(s) URL"); return; }
    if (images.length >= MAX_IMAGES) { toast.error(`Max ${MAX_IMAGES} images`); return; }
    setImages((prev) => [...prev, u]);
    setNewImage("");
  };
  const removeImage = (i: number) => setImages((prev) => prev.filter((_, idx) => idx !== i));

  const save = useMutation({
    mutationFn: async () => {
      const p = Number(price);
      if (!name.trim() || name.trim().length < 2) throw new Error("Name too short");
      if (!Number.isFinite(p) || p < 0) throw new Error("Invalid price");
      const cat = categoryKey === NEW_KEY ? newCategory.trim() : categoryKey || null;
      return updateFn({
        data: {
          id: row.id,
          name: name.trim(),
          description: description.trim() || null,
          price: p,
          category: cat || null,
          images,
        },
      });
    },
    onSuccess: () => {
      toast.success("Request updated.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit product request</DialogTitle>
          <DialogDescription>Update details before approving. Same fields as Add Product.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Base price *</Label>
              <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={categoryKey || undefined} onValueChange={(v) => setCategoryKey(v)}>
                <SelectTrigger>
                  <SelectValue placeholder={existingCategories.length === 0 ? "No categories yet — create one" : "Choose or create"} />
                </SelectTrigger>
                <SelectContent>
                  {existingCategories.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No categories yet.</div>
                  )}
                  {existingCategories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                  <SelectItem value={NEW_KEY}>+ New category…</SelectItem>
                </SelectContent>
              </Select>
              {categoryKey === NEW_KEY && (
                <Input
                  placeholder="New category name"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                />
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Images ({images.length}/{MAX_IMAGES})</Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://…"
                value={newImage}
                onChange={(e) => setNewImage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addImage(); } }}
              />
              <Button type="button" variant="outline" onClick={addImage}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {images.map((u, i) => (
                  <div key={`${u}-${i}`} className="relative">
                    <img src={u} alt="" className="h-16 w-16 rounded border object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-destructive text-destructive-foreground"
                      aria-label="Remove image"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

