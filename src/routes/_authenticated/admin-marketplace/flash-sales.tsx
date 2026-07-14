import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Search, Zap, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MarketplaceAdminShell } from "@/components/marketplace-admin/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useFlashSales,
  useProductSearch,
  useAddFlashSale,
  useRemoveFlashSale,
} from "@/lib/marketplace-admin";

export const Route = createFileRoute("/_authenticated/admin-marketplace/flash-sales")({
  head: () => ({ meta: [{ title: "Flash Sales — EasyStore365 Control" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (!(r ?? []).some((x) => x.role === "super_admin")) throw redirect({ to: "/dashboard" });
  },
  component: FlashSalesPage,
});

function countdown(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function FlashSalesPage() {
  const list = useFlashSales();
  const remove = useRemoveFlashSale();
  const [open, setOpen] = useState(false);
  const [_, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 60_000); return () => clearInterval(id); }, []);

  return (
    <MarketplaceAdminShell
      currentPath="/admin-marketplace/flash-sales"
      title="Flash Sale Controller"
      description="Pick any marketplace product, assign a discount %, and set a countdown. Live changes appear instantly on EasyStore365.com."
      actions={
        <Button onClick={() => setOpen(true)} className="gradient-primary text-primary-foreground">
          <Plus className="mr-1.5 h-4 w-4" /> Add to Flash Sale
        </Button>
      }
    >
      {list.isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (list.data ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card py-16 text-center text-sm text-muted-foreground">
          No active flash sales.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.data!.map((f) => {
            const ended = new Date(f.ends_at).getTime() <= Date.now();
            return (
              <div key={f.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                {f.product?.image_url ? (
                  <img src={f.product.image_url} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-20 w-20 shrink-0 rounded-lg bg-muted" />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="truncate font-semibold text-sm">{f.product?.name ?? "Unknown product"}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 font-bold text-red-600 dark:text-red-400">
                      <Zap className="h-3 w-3" /> -{f.discount_percent}%
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${ended ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                      <Clock className="h-3 w-3" /> {countdown(f.ends_at)}
                    </span>
                  </div>
                  <div className="mt-auto flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => remove.mutate(f.id)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddFlashDialog open={open} setOpen={setOpen} />
    </MarketplaceAdminShell>
  );
}

function AddFlashDialog({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [discount, setDiscount] = useState(20);
  const [endsAt, setEndsAt] = useState("");
  const search = useProductSearch(query);
  const add = useAddFlashSale();

  useEffect(() => {
    if (!open) { setQuery(""); setSelected(null); setDiscount(20); setEndsAt(""); }
  }, [open]);

  function submit() {
    if (!selected) return toast.error("Pick a product");
    if (!endsAt) return toast.error("Set an end time");
    if (discount < 1 || discount > 95) return toast.error("Discount 1–95%");
    add.mutate(
      { product_id: selected.id, discount_percent: discount, ends_at: new Date(endsAt).toISOString() },
      {
        onSuccess: () => { toast.success("Added to flash sale"); setOpen(false); },
        onError: (e: any) => toast.error(e.message || "Failed"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add to Flash Sale</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Product</Label>
            {selected ? (
              <div className="mt-1 flex items-center justify-between rounded-lg border p-2 text-sm">
                <span className="truncate font-medium">{selected.name}</span>
                <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>Change</Button>
              </div>
            ) : (
              <>
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products…" className="pl-8" />
                </div>
                {query.trim().length >= 2 && (
                  <div className="mt-2 max-h-52 overflow-auto rounded-lg border">
                    {search.isLoading ? (
                      <div className="p-3 text-center text-xs text-muted-foreground">Searching…</div>
                    ) : (search.data ?? []).length === 0 ? (
                      <div className="p-3 text-center text-xs text-muted-foreground">No matches</div>
                    ) : (
                      search.data!.map((p: any) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelected({ id: p.id, name: p.name })}
                          className="flex w-full items-center gap-2 border-b p-2 text-left text-sm last:border-b-0 hover:bg-muted"
                        >
                          {p.image_url && <img src={p.image_url} alt="" className="h-8 w-8 rounded object-cover" />}
                          <span className="flex-1 truncate">{p.name}</span>
                          {p.price != null && <span className="text-xs text-muted-foreground">৳{p.price}</span>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Discount %</Label>
              <Input type="number" min={1} max={95} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
            </div>
            <div>
              <Label>Ends at</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={add.isPending} className="gradient-primary text-primary-foreground">
            {add.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
