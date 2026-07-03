import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Package, CheckCircle2, Circle, Printer, RotateCcw } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/account/orders/$id")({
  component: OrderDetailsPage,
});


type OrderDetails = {
  id: string;
  store_id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  notes: string | null;
  subtotal: number;
  delivery_charge: number;
  discount: number;
  total: number;
  created_at: string;
  updated_at: string;
  items: {
    id: string;
    name: string;
    variant_label: string | null;
    price: number;
    quantity: number;
    subtotal: number;
  }[];
};

const STATUS_FLOW = ["pending", "confirmed", "processing", "shipped", "delivered"] as const;

function OrderDetailsPage() {
  const { id } = Route.useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["account", "order", id],
    queryFn: async (): Promise<OrderDetails | null> => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return null;

      const { data: order, error: oErr } = await supabase
        .from("orders")
        .select("id, store_id, order_number, status, payment_status, payment_method, customer_name, customer_phone, customer_address, notes, subtotal, delivery_charge, discount, total, created_at, updated_at")
        .eq("id", id)
        .eq("customer_user_id", uid)
        .maybeSingle();
      if (oErr) throw oErr;
      if (!order) return null;

      const { data: items, error: iErr } = await supabase
        .from("order_items")
        .select("id, name, variant_label, price, quantity, subtotal")
        .eq("order_id", id);
      if (iErr) throw iErr;

      return { ...order, items: items ?? [] } as OrderDetails;
    },
  });

  const { data: requests } = useQuery({
    queryKey: ["account", "order", id, "requests"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("order_requests")
        .select("id, type, reason, status, resolution_notes, created_at, updated_at")
        .eq("order_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return rows ?? [];
    },
  });


  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/account/orders"><ArrowLeft className="mr-1 h-4 w-4" /> Back to orders</Link>
        </Button>
        <div className="grid place-items-center gap-2 py-12 text-center text-muted-foreground">
          <Package className="h-10 w-10" />
          <p>Order not found.</p>
        </div>
      </div>
    );
  }

  const currentIdx = STATUS_FLOW.indexOf(data.status as typeof STATUS_FLOW[number]);
  const isCancelled = data.status === "cancelled";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/account/orders"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
          <h1 className="mt-1 text-2xl font-bold">Order #{data.order_number}</h1>
          <p className="text-sm text-muted-foreground">
            Placed on {new Date(data.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-1">
            <Badge variant="secondary">{data.status}</Badge>
            <Badge variant="outline">{data.payment_status}</Badge>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="mr-1 h-4 w-4" /> Invoice
            </Button>
            <RequestDialog
              orderId={data.id}
              storeId={data.store_id}
              disabled={isCancelled || data.status === "delivered" && false}
            />
          </div>
        </div>
      </div>


      {/* Status history */}
      <div className="rounded-lg border p-4">
        <h2 className="mb-4 text-sm font-semibold">Status</h2>
        {isCancelled ? (
          <p className="text-sm text-destructive">This order was cancelled.</p>
        ) : (
          <ol className="space-y-3">
            {STATUS_FLOW.map((s, idx) => {
              const done = idx <= currentIdx;
              const isCurrent = idx === currentIdx;
              return (
                <li key={s} className="flex items-center gap-3 text-sm">
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={done ? "font-medium capitalize" : "capitalize text-muted-foreground"}>
                    {s}
                  </span>
                  {isCurrent && (
                    <span className="text-xs text-muted-foreground">
                      · updated {new Date(data.updated_at).toLocaleString()}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Items */}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((it) => (
              <TableRow key={it.id}>
                <TableCell>
                  <div className="font-medium">{it.name}</div>
                  {it.variant_label && (
                    <div className="text-xs text-muted-foreground">{it.variant_label}</div>
                  )}
                </TableCell>
                <TableCell className="text-right">{Number(it.price).toLocaleString()} ৳</TableCell>
                <TableCell className="text-right">{it.quantity}</TableCell>
                <TableCell className="text-right font-medium">
                  {Number(it.subtotal).toLocaleString()} ৳
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Totals + address */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4 text-sm">
          <h2 className="mb-3 font-semibold">Delivery</h2>
          <p>{data.customer_name}</p>
          <p className="text-muted-foreground">{data.customer_phone}</p>
          <p className="mt-2 whitespace-pre-line text-muted-foreground">{data.customer_address}</p>
          {data.notes && (
            <p className="mt-3 text-muted-foreground"><span className="font-medium text-foreground">Notes:</span> {data.notes}</p>
          )}
        </div>
        <div className="rounded-lg border p-4 text-sm">
          <h2 className="mb-3 font-semibold">Summary</h2>
          <Row label="Subtotal" value={data.subtotal} />
          <Row label="Delivery" value={data.delivery_charge} />
          {Number(data.discount) > 0 && <Row label="Discount" value={-data.discount} />}
          <div className="mt-2 flex justify-between border-t pt-2 text-base font-bold">
            <span>Total</span>
            <span>{Number(data.total).toLocaleString()} ৳</span>
          </div>
          {data.payment_method && (
            <p className="mt-3 text-xs text-muted-foreground">Payment: {data.payment_method}</p>
          )}
        </div>
      </div>

      {/* Return / cancellation requests */}
      {(requests ?? []).length > 0 && (
        <div className="rounded-lg border p-4 print:hidden">
          <h2 className="mb-4 text-sm font-semibold">Your requests</h2>
          <ul className="space-y-6">
            {(requests ?? []).map((r) => (
              <li key={r.id} className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-medium capitalize">{r.type} request</span>
                  <Badge variant="secondary" className="capitalize">{r.status}</Badge>
                </div>
                <p className="mb-4 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Reason:</span> {r.reason}
                </p>
                <RequestTimeline
                  status={r.status}
                  createdAt={r.created_at}
                  updatedAt={r.updated_at}
                  notes={r.resolution_notes}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RequestTimeline({
  status, createdAt, updatedAt, notes,
}: {
  status: string;
  createdAt: string;
  updatedAt: string;
  notes: string | null;
}) {
  const isResolved = status !== "pending";
  const isRejected = status === "rejected";
  const isCompleted = status === "completed";

  const reviewLabel = isRejected ? "Denied" : status === "approved" || isCompleted ? "Approved" : "Under review";
  const steps = [
    {
      key: "requested",
      label: "Requested",
      done: true,
      time: createdAt,
      note: null as string | null,
    },
    {
      key: "review",
      label: reviewLabel,
      done: isResolved,
      time: isResolved ? updatedAt : null,
      note: isResolved ? notes : null,
      danger: isRejected,
    },
    {
      key: "processed",
      label: "Processed",
      done: isCompleted,
      time: isCompleted ? updatedAt : null,
      note: null,
    },
  ];

  return (
    <ol className="relative space-y-4 border-l pl-5">
      {steps.map((s) => (
        <li key={s.key} className="relative">
          <span
            className={
              "absolute -left-[27px] top-1 grid h-4 w-4 place-items-center rounded-full border-2 " +
              (s.done
                ? s.danger
                  ? "border-destructive bg-destructive"
                  : "border-primary bg-primary"
                : "border-muted-foreground/40 bg-background")
            }
          />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span
              className={
                "text-sm font-medium " +
                (s.done ? (s.danger ? "text-destructive" : "") : "text-muted-foreground")
              }
            >
              {s.label}
            </span>
            {s.time && (
              <span className="text-xs text-muted-foreground">
                {new Date(s.time).toLocaleString()}
              </span>
            )}
          </div>
          {s.note && (
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Admin note:</span> {s.note}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}


function RequestDialog({
  orderId, storeId, disabled,
}: { orderId: string; storeId: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"cancellation" | "return">("cancellation");
  const [reason, setReason] = useState("");
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmed = reason.trim();
      if (trimmed.length < 5) throw new Error("Please provide a brief reason (min 5 characters).");
      if (trimmed.length > 1000) throw new Error("Reason must be under 1000 characters.");
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("You must be signed in.");
      const { error } = await supabase.from("order_requests").insert({
        order_id: orderId,
        store_id: storeId,
        customer_user_id: uid,
        type,
        reason: trimmed,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request submitted");
      setReason("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["account", "order", orderId, "requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <RotateCcw className="mr-1 h-4 w-4" /> Return / Cancel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request return or cancellation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Request type</Label>
            <Select value={type} onValueChange={(v) => setType(v as "cancellation" | "return")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cancellation">Cancellation</SelectItem>
                <SelectItem value="return">Return</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tell the seller why..."
              maxLength={1000}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <span>{Number(value).toLocaleString()} ৳</span>
    </div>
  );

}
