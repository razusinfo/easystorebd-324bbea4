import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ShieldCheck, Users, ClipboardList, Check, X, ArrowLeft, Search, Loader2, LogOut, Ban, MessageSquare, UserCog,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  useAdminStores, useAdminProducts, useIsSuperAdmin, useModerateProduct, useAdminUsers,
} from "@/lib/eazystore-data";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Super Admin — EazyStore" }] }),
  component: Admin,
});

function Admin() {
  const navigate = useNavigate();
  const isAdmin = useIsSuperAdmin();
  const stores = useAdminStores();
  const products = useAdminProducts();
  const moderate = useModerateProduct();
  const users = useAdminUsers();
  const [tab, setTab] = useState<"pending" | "stores" | "users">("pending");
  const [q, setQ] = useState("");

  const pending = useMemo(
    () => (products.data ?? []).filter((p) => p.status === "pending"),
    [products.data],
  );

  const filteredStores = useMemo(() => {
    const list = stores.data ?? [];
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter((s) => s.name.toLowerCase().includes(t) || s.category.toLowerCase().includes(t));
  }, [stores.data, q]);

  const filteredUsers = useMemo(() => {
    const list = users.data ?? [];
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter((u) =>
      (u.email ?? "").toLowerCase().includes(t) ||
      (u.full_name ?? "").toLowerCase().includes(t) ||
      u.roles.some((r) => r.toLowerCase().includes(t)),
    );
  }, [users.data, q]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  if (isAdmin.isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAdmin.data) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5 text-center">
        <div className="max-w-sm space-y-4">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <Ban className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-bold">Admin access only</h1>
          <p className="text-sm text-muted-foreground">
            Your account doesn't have the <code className="rounded bg-muted px-1.5 py-0.5 text-xs">super_admin</code> role.
            An existing admin must grant it before you can moderate.
          </p>
          <div className="flex justify-center gap-2">
            <Link to="/dashboard" className="rounded-2xl border border-border bg-background px-4 py-2 text-sm font-semibold">
              My dashboard
            </Link>
            <button onClick={signOut} className="rounded-2xl gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground">
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-16 text-foreground">
      <div className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.35),transparent_60%)]" />
        <div className="mx-auto max-w-5xl px-5 pb-8 pt-6">
          <div className="flex items-center justify-between">
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white">
              <ArrowLeft className="h-3.5 w-3.5" /> Home
            </Link>
            <div className="flex items-center gap-2">
              <Link
                to="/sms-settings"
                className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur hover:bg-white/20"
              >
                <MessageSquare className="h-3 w-3" /> SMS template
              </Link>
              <button
                onClick={signOut}
                className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur hover:bg-white/20"
              >
                <LogOut className="h-3 w-3" /> Sign out
              </button>
            </div>
          </div>
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
            <AdminStat label="Registered stores" value={(stores.data ?? []).length} />
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl gap-1 px-5">
          <TabBtn active={tab === "pending"} onClick={() => setTab("pending")}>
            <ClipboardList className="h-4 w-4" />
            Pending
            <span className="ml-1 rounded-full bg-warning/20 px-1.5 text-[10px] font-bold text-warning-foreground">
              {pending.length}
            </span>
          </TabBtn>
          <TabBtn active={tab === "stores"} onClick={() => setTab("stores")}>
            <Users className="h-4 w-4" />
            Stores
            <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] font-bold text-muted-foreground">
              {(stores.data ?? []).length}
            </span>
          </TabBtn>
          <TabBtn active={tab === "users"} onClick={() => setTab("users")}>
            <UserCog className="h-4 w-4" />
            Users
            <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] font-bold text-muted-foreground">
              {(users.data ?? []).length}
            </span>
          </TabBtn>
        </div>
      </div>

      <section className="mx-auto max-w-5xl px-5 py-5">
        {tab === "pending" ? (
          <div className="space-y-3">
            {products.isLoading ? (
              <Center><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></Center>
            ) : pending.length === 0 ? (
              <Empty title="All clear" desc="No pending listings right now." />
            ) : (
              pending.map((p) => {
                const s = (stores.data ?? []).find((x) => x.id === p.store_id);
                return (
                  <div key={p.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
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
                            ৳{Number(p.price).toLocaleString()}
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
                        disabled={moderate.isPending}
                        onClick={() => moderate.mutate({ id: p.id, status: "rejected" })}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" /> Reject
                      </button>
                      <button
                        disabled={moderate.isPending}
                        onClick={() => moderate.mutate({ id: p.id, status: "approved" })}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl gradient-success px-3 py-2.5 text-sm font-bold text-success-foreground shadow-sm disabled:opacity-50"
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
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search by store or category"
                className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
              />
            </div>

            {stores.isLoading ? (
              <Center><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></Center>
            ) : filteredStores.length === 0 ? (
              <Empty title="No stores" desc="Try a different search term." />
            ) : (
              filteredStores.map((s) => {
                const count = (products.data ?? []).filter((p) => p.store_id === s.id).length;
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
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Joined {new Date(s.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold">{s.category}</span>
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
        active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
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

function Center({ children }: { children: React.ReactNode }) {
  return <div className="grid place-items-center py-10">{children}</div>;
}
