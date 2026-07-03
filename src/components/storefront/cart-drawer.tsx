import { useState, useEffect } from "react";
import { Minus, Plus, Trash2, ShoppingBag, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCartStore, useStoreCart, cartTotal, cartCount, type CartItem } from "@/lib/cart-store";

type Props = {
  storeId: string;
  storeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CartDrawer({ storeId, storeName, open, onOpenChange }: Props) {
  const items: CartItem[] = useStoreCart(storeId);
  const setQty = useCartStore((s) => s.setQty);
  const remove = useCartStore((s) => s.remove);
  const clear = useCartStore((s) => s.clear);

  const [checkingOut, setCheckingOut] = useState(false);
  const [placed, setPlaced] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const total = cartTotal(items);
  const count = cartCount(items);

  async function placeOrder() {
    if (!items.length) return;
    if (!name.trim() || !phone.trim()) {
      toast.error("Please enter your name and phone number");
      return;
    }
    setCheckingOut(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const customerUserId = userRes.user?.id ?? null;
      const orderId =
        (typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
      // RLS on `orders` blocks SELECT for the inserter (guest or shopper),
      // so we don't use RETURNING. Generate id + order_number client-side.
      const { error: oErr } = await supabase
        .from("orders")
        .insert({
          id: orderId,
          store_id: storeId,
          order_number: orderNumber,
          customer_user_id: customerUserId,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          customer_address: address.trim() || null,
          notes: notes.trim() || null,
          subtotal: total,
          delivery_charge: 0,
          discount: 0,
          total,
          status: "pending",
          payment_status: "unpaid",
        });
      if (oErr) throw oErr;

      const { error: iErr } = await supabase.from("order_items").insert(
        items.map((it) => ({
          order_id: orderId,
          product_id: it.productId,
          name: it.name,
          price: it.price,
          quantity: it.qty,
          subtotal: it.price * it.qty,
        }))
      );
      if (iErr) throw iErr;

      clear(storeId);
      setPlaced(orderNumber);
      setName(""); setPhone(""); setAddress(""); setNotes("");
      toast.success(`Order ${orderNumber} placed!`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not place order");
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setPlaced(null); }}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Your cart {count > 0 && `(${count})`}</SheetTitle>
          <SheetDescription>
            {placed
              ? `Thanks! Your order has been received.`
              : `Review items from ${storeName} before checkout.`}
          </SheetDescription>
        </SheetHeader>

        {placed ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <p className="font-display text-lg font-bold">Order {placed} placed</p>
            <p className="text-sm text-muted-foreground">
              The store owner will contact you shortly on {phone || "your phone"}.
            </p>
            <Button onClick={() => onOpenChange(false)} className="mt-2">Keep shopping</Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <ShoppingBag className="h-10 w-10" />
            <p>Your cart is empty.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-3 py-2">
              {items.map((it) => (
                <div key={it.productId} className="flex gap-3 rounded-lg border p-2">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                    {it.imageUrl ? (
                      <img src={it.imageUrl} alt={it.name} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col justify-between">
                    <p className="line-clamp-2 text-sm font-medium">{it.name}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button" size="icon" variant="outline"
                          className="h-7 w-7"
                          onClick={() => setQty(storeId, it.productId, it.qty - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-semibold">{it.qty}</span>
                        <Button
                          type="button" size="icon" variant="outline"
                          className="h-7 w-7"
                          onClick={() => setQty(storeId, it.productId, it.qty + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">
                          {(it.price * it.qty).toLocaleString()} ৳
                        </span>
                        <Button
                          type="button" size="icon" variant="ghost"
                          className="h-7 w-7 text-muted-foreground"
                          onClick={() => remove(storeId, it.productId)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t pt-3">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span className="font-bold">{total.toLocaleString()} ৳</span>
              </div>
              <div className="grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="cart-name" className="text-xs">Name *</Label>
                    <Input id="cart-name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="cart-phone" className="text-xs">Phone *</Label>
                    <Input id="cart-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="cart-address" className="text-xs">Address</Label>
                  <Input id="cart-address" value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="cart-notes" className="text-xs">Notes</Label>
                  <Textarea id="cart-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
            </div>

            <SheetFooter>
              <Button
                type="button"
                className="w-full"
                disabled={checkingOut}
                onClick={placeOrder}
              >
                {checkingOut ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Placing…</>
                ) : (
                  <>Place order — {total.toLocaleString()} ৳</>
                )}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
