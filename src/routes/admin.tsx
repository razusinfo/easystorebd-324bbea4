import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ShieldCheck, Users, ClipboardList, Check, X, ArrowLeft, Search, Mail, Phone,
} from "lucide-react";
import { db, useStoreData } from "@/lib/eazystore-store";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Super Admin — EazyStore" },
      { name: "description", content: "Review stores and moderate pending product listings." },
    ],
  }),
  component: Admin,
});

function Admin() {
  const navigate = useNavigate();
  const { stores, products } = useStoreData();
  const [tab, setTab] = useState<"pending" | "users">("pending");
  const [q, setQ] = useState("");

  const pending = useMemo(
    () => products.filter((p) => p.status === "pending"),
    [products],
  );

  const filteredStores = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return stores;
    return stores.filter(
      (s) =>
        s.name.toLowerCase().includes(t) ||
        s.ownerName.toLowerCase().includes(t) ||
        s.ownerContact.toLowerCase().includes(t),
    );
  }, [stores, q]);

  return (
    <main className="min-h-screen bg-background pb-16 text-foreground">
      <div className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.35),transparent_60%)]" />
        <div className="mx-auto max-w-5xl px-5 pb-8 pt-6">
          <button
            onClick={() => navigate({ to: "/" })}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </button>
          <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 backdrop-blur">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Super Admin</p>
              <h1 className="truncate font-display text-2xl font-black sm:text-3xl">Moderation Console</h1>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <AdminStat label="Pending listings" value={pending.length} />
            <AdminStat label="Registered stores" value={stores.length} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl gap-1 px-5">
          <TabBtn active={tab === "pending"} onClick={() => setTab("pending")}>
            <ClipboardList className="h-4 w-4" />
            Pending
            <span className="ml-1 rounded-full bg-warning/20 px-1.5 text-[10px] font-bold text-warning-foreground">
              {pending.length}
            </span>
          </TabBtn>
          <TabBtn active={tab === "users"} onClick={() => setTab("users")}>
            <Users className="h-4 w-4" />
            Users
            <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] font-bold text-muted-foreground">
              {stores.length}
            </span>
          </TabBtn>
        </div>
      </div>

      <section className="mx-auto max-w-5xl px-5 py-5">
        {tab === "pending" ? (
          <div className="space-y-3">
            {pending.length === 0 ? (
              <Empty
                title="All clear"
                desc="No pending listings right now. New submissions appear here."
              />
            ) : (
              pending.map((p) => {
                const s = stores.find((x) => x.id === p.storeId);
                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{p.name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/70">{s?.name ?? "Unknown store"}</span>
                          <span>·</span>
                          <span>{s?.category}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-xs">
                          <span className="rounded-md bg-muted px-2 py-0.5 font-semibold tabular-nums">
                            ৳{p.price.toLocaleString()}
                          </span>
                          <span className="text-muted-foreground">{p.stock} in stock</span>
                        </div>
                      </div>
                      <span className="shrink-0 self-start rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-bold text-warning-foreground">
                        Pending
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => db.updateProduct(p.id, { status: "rejected" })}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/5"
                      >
                        <X className="h-4 w-4" /> Reject
                      </button>
                      <button
                        onClick={() => db.updateProduct(p.id, { status: "approved" })}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl gradient-success px-3 py-2.5 text-sm font-bold text-success-foreground shadow-sm"
                      >
                        <Check className="h-4 w-4" /> Approve
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-stretch overflow-hidden rounded-2xl border-2 border-border focus-within:border-primary">
              <span className="grid place-items-center bg-muted px-3 text-muted-foreground">
                <Search className="h-4 w-4" />
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by store, owner, or contact"
                className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
              />
            </div>

            {filteredStores.length === 0 ? (
              <Empty title="No users" desc="Try a different search term." />
            ) : (
              filteredStores.map((s) => {
                const count = products.filter((p) => p.storeId === s.id).length;
                return (
                  <div
                    key={s.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm"
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl gradient-primary text-sm font-bold text-white">
                      {s.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{s.name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        {s.loginMethod === "google" ? (
                          <Mail className="h-3 w-3 shrink-0" />
                        ) : (
                          <Phone className="h-3 w-3 shrink-0" />
                        )}
                        <span className="truncate">{s.ownerContact}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold">
                        {s.category}
                      </span>
                      <div className="mt-1 text-[11px] text-muted-foreground">{count} products</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function AdminStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur">
      <div className="text-3xl font-black tabular-nums">{value}</div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-white/70">{label}</div>
    </div>
  );
}

function TabBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-semibold transition ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Empty({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <ClipboardList className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
