import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Search, Plus, Minus, Trash2, Printer, CreditCard, User, Percent, Receipt } from "lucide-react";
import { useI18n, formatCurrency } from "@/lib/i18n";
import { products } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/pos")({
  head: () => ({ meta: [{ title: "POS — Bongo Inventory" }] }),
  component: POSPage,
});

type CartItem = { id: string; name: string; price: number; qty: number };

function POSPage() {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [vatPct, setVatPct] = useState(5);

  const filtered = useMemo(
    () => products.filter((p) =>
      [p.name, p.nameBn, p.sku, p.brand, p.category].join(" ").toLowerCase().includes(query.toLowerCase())
    ),
    [query]
  );

  const add = (id: string) => {
    const p = products.find((x) => x.id === id)!;
    setCart((c) => {
      const ex = c.find((i) => i.id === id);
      if (ex) return c.map((i) => i.id === id ? { ...i, qty: i.qty + 1 } : i);
      return [...c, { id, name: lang === "bn" ? p.nameBn : p.name, price: p.price, qty: 1 }];
    });
  };
  const setQty = (id: string, qty: number) => {
    if (qty <= 0) return setCart((c) => c.filter((i) => i.id !== id));
    setCart((c) => c.map((i) => i.id === id ? { ...i, qty } : i));
  };

  const subtotal = cart.reduce((a, b) => a + b.price * b.qty, 0);
  const vat = ((subtotal - discount) * vatPct) / 100;
  const total = Math.max(0, subtotal - discount + vat);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4 h-[calc(100vh-10rem)]">
      {/* products */}
      <div className="glass-card rounded-2xl p-4 flex flex-col min-w-0 min-h-0">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lang === "bn" ? "পণ্য / বারকোড / SKU অনুসন্ধান..." : "Search product / barcode / SKU..."}
            className="w-full h-12 pl-10 pr-3 rounded-xl bg-muted/40 border border-border focus:border-ring outline-none font-semibold"
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 pr-1">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => add(p.id)}
              className="text-left p-3 rounded-xl bg-card border border-border hover:border-primary hover:shadow-glow hover:-translate-y-0.5 transition group"
            >
              <div className="aspect-square rounded-lg gradient-primary opacity-90 mb-2 grid place-items-center text-primary-foreground font-black text-lg">
                {p.brand.charAt(0)}
              </div>
              <div className="font-semibold text-sm leading-tight line-clamp-2">{lang === "bn" ? p.nameBn : p.name}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{p.sku}</div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="font-black text-primary text-sm">{formatCurrency(p.price, lang)}</span>
                <span className="text-[10px] font-bold text-muted-foreground">{p.stock}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* cart */}
      <div className="glass-card rounded-2xl flex flex-col min-h-0">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <h3 className="font-display font-bold text-lg flex-1">{t("cart")}</h3>
          <span className="text-xs font-semibold text-muted-foreground">{cart.length} {lang === "bn" ? "টি" : "items"}</span>
        </div>

        <div className="px-4 py-2 border-b border-border flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <input
            placeholder={t("walkIn")}
            className="flex-1 bg-transparent outline-none font-semibold"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {cart.length === 0 ? (
            <div className="h-full grid place-items-center text-sm text-muted-foreground text-center px-6">
              {t("emptyCart")}
            </div>
          ) : (
            <div className="space-y-1.5">
              {cart.map((i) => (
                <div key={i.id} className="p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{i.name}</div>
                      <div className="text-xs text-muted-foreground">{formatCurrency(i.price, lang)}</div>
                    </div>
                    <button onClick={() => setQty(i.id, 0)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQty(i.id, i.qty - 1)} className="grid h-7 w-7 place-items-center rounded-lg bg-card border border-border hover:bg-muted">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center font-bold text-sm">{i.qty}</span>
                      <button onClick={() => setQty(i.id, i.qty + 1)} className="grid h-7 w-7 place-items-center rounded-lg bg-card border border-border hover:bg-muted">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="font-black text-sm">{formatCurrency(i.price * i.qty, lang)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border space-y-3 bg-card/50">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs">
              <span className="block text-muted-foreground mb-1">{t("discount")}</span>
              <div className="relative">
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(+e.target.value || 0)}
                  className="w-full h-9 pl-2 pr-7 rounded-lg bg-muted border border-border outline-none font-semibold text-sm"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">৳</span>
              </div>
            </label>
            <label className="text-xs">
              <span className="block text-muted-foreground mb-1">{t("vat")}</span>
              <div className="relative">
                <input
                  type="number"
                  value={vatPct}
                  onChange={(e) => setVatPct(+e.target.value || 0)}
                  className="w-full h-9 pl-2 pr-7 rounded-lg bg-muted border border-border outline-none font-semibold text-sm"
                />
                <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              </div>
            </label>
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-semibold">{formatCurrency(subtotal, lang)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("discount")}</span><span className="font-semibold text-destructive">−{formatCurrency(discount, lang)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("vat")} ({vatPct}%)</span><span className="font-semibold">{formatCurrency(vat, lang)}</span></div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl gradient-primary text-primary-foreground">
            <span className="font-bold">{t("total")}</span>
            <span className="font-display font-black text-2xl">{formatCurrency(total, lang)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button className="h-12 rounded-xl bg-card border border-border hover:bg-muted flex items-center justify-center gap-2 font-bold text-sm">
              <Printer className="h-4 w-4" /> {t("print")}
            </button>
            <button
              disabled={cart.length === 0}
              className="h-12 rounded-xl gradient-success text-success-foreground disabled:opacity-40 flex items-center justify-center gap-2 font-bold text-sm shadow-md"
            >
              <CreditCard className="h-4 w-4" /> {t("checkout")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
