import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Check, X, ImageIcon, ShieldAlert } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/lib/eazystore-data";
import { approveProductRequest, rejectProductRequest } from "@/lib/product-requests.functions";
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

function AdminRequestsList() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const q = useQuery({
    queryKey: ["admin-product-requests", filter],
    queryFn: async () => {
      let query = supabase
        .from("product_requests")
        .select("id, name, description, price, category, images, status, requested_by, created_at, reseller_price")
        .order("created_at", { ascending: false });
      if (filter === "pending") query = query.eq("status", "pending");
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as RequestRow[];
    },
  });

  const ids = Array.from(new Set((q.data ?? []).map((r) => r.requested_by)));
  const profiles = useQuery({
    queryKey: ["admin-request-profiles", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, name").in("id", ids);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.name as string]));
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-product-requests"] });
    qc.invalidateQueries({ queryKey: ["pending-product-requests"] });
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Request Review</h1>
          <p className="text-sm text-muted-foreground">Approve or reject reseller product submissions.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={filter === "pending" ? "default" : "outline"} size="sm" onClick={() => setFilter("pending")}>
            Pending
          </Button>
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
            All
          </Button>
        </div>
      </div>

      {q.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (q.data?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No {filter === "pending" ? "pending" : ""} requests.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {q.data!.map((r) => (
            <RequestCard
              key={r.id}
              row={r}
              resellerName={profiles.data?.[r.requested_by] ?? "Unknown"}
              onDone={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({
  row, resellerName, onDone,
}: {
  row: RequestRow;
  resellerName: string;
  onDone: () => void;
}) {
  const approveFn = useServerFn(approveProductRequest);
  const rejectFn = useServerFn(rejectProductRequest);
  const [approveOpen, setApproveOpen] = useState(false);
  const [resellerPrice, setResellerPrice] = useState<string>(String(row.price));
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");

  const approve = useMutation({
    mutationFn: async () => {
      const p = Number(resellerPrice);
      if (!Number.isFinite(p) || p < 0) throw new Error("Enter a valid reseller price");
      return approveFn({
        data: { request_id: row.id, reseller_price: p, admin_notes: adminNotes || null },
      });
    },
    onSuccess: () => {
      toast.success("Request approved — added to Reseller Products.");
      setApproveOpen(false);
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
              <Label htmlFor="an">Admin notes (optional)</Label>
              <Textarea id="an" rows={3} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
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
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary";
  return <Badge variant={variant as "default" | "destructive" | "secondary"}>{status}</Badge>;
}
