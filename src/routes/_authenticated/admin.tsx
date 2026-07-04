import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck, Users, ClipboardList, Check, X, ArrowLeft, Search, Loader2, LogOut, Ban, MessageSquare, UserCog, ScrollText, Plus, Trash2, Palette, PackagePlus,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useAdminStores, useAdminProducts, useIsSuperAdmin, useModerateProduct, useAdminUsers,
  useAdminAuditLogs, useAssignRole, useRevokeRole,
  type AdminUserRow, type AppRole,
} from "@/lib/eazystore-data";
import { UICustomizer } from "@/components/admin/ui-customizer";
import { approveProductRequest, rejectProductRequest } from "@/lib/product-requests.functions";


const ASSIGNABLE_ROLES: AppRole[] = [
  "super_admin", "store_owner", "manager", "cashier", "salesman", "accountant", "technician", "warehouse_manager",
];

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
  const auditLogs = useAdminAuditLogs();
  const [tab, setTab] = useState<"pending" | "requests" | "stores" | "users" | "audit" | "customizer">("pending");
  const [q, setQ] = useState("");
  const [manageUser, setManageUser] = useState<AdminUserRow | null>(null);


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
              <NotificationBell onOpenRequests={() => setTab("requests")} />
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
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto whitespace-nowrap px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabBtn active={tab === "pending"} onClick={() => setTab("pending")}>
            <ClipboardList className="h-4 w-4" />
            Pending
            <span className="ml-1 rounded-full bg-warning/20 px-1.5 text-[10px] font-bold text-warning-foreground">
              {pending.length}
            </span>
          </TabBtn>
          <TabBtn active={tab === "requests"} onClick={() => setTab("requests")}>
            <PackagePlus className="h-4 w-4" />
            Requests
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
          <TabBtn active={tab === "audit"} onClick={() => setTab("audit")}>
            <ScrollText className="h-4 w-4" />
            Audit
            <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] font-bold text-muted-foreground">
              {(auditLogs.data ?? []).length}
            </span>
          </TabBtn>
          <TabBtn active={tab === "customizer"} onClick={() => setTab("customizer")}>
            <Palette className="h-4 w-4" />
            UI Customizer
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
        ) : tab === "requests" ? (
          <ProductRequestsPanel />
        ) : tab === "stores" ? (
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
        ) : tab === "users" ? (
          <div className="space-y-3">
            <div className="flex items-stretch overflow-hidden rounded-2xl border-2 border-border focus-within:border-primary">
              <span className="grid place-items-center bg-muted px-3 text-muted-foreground">
                <Search className="h-4 w-4" />
              </span>
              <input
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search by email, name, or role"
                className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
              />
            </div>

            {users.isLoading ? (
              <Center><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></Center>
            ) : users.error ? (
              <Empty title="Couldn't load users" desc={(users.error as Error).message} />
            ) : filteredUsers.length === 0 ? (
              <Empty title="No users" desc="Try a different search term." />
            ) : (
              filteredUsers.map((u) => {
                const initial = (u.full_name ?? u.email ?? "?").slice(0, 1).toUpperCase();
                return (
                  <div
                    key={u.user_id}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm"
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl gradient-primary text-sm font-bold text-white">
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{u.full_name || u.email || "Unnamed user"}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{u.email ?? "—"}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        Joined {new Date(u.created_at).toLocaleDateString()}
                        {u.last_sign_in_at ? ` · Last seen ${new Date(u.last_sign_in_at).toLocaleDateString()}` : ""}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {u.roles.length === 0 ? (
                          <RoleBadge role="none" />
                        ) : (
                          u.roles.map((r) => <RoleBadge key={r} role={r} />)
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setManageUser(u)}
                      className="shrink-0 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted"
                    >
                      Manage roles
                    </button>
                  </div>
                );
              })
            )}
          </div>
        ) : tab === "audit" ? (
          <div className="space-y-2">
            {auditLogs.isLoading ? (
              <Center><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></Center>
            ) : auditLogs.error ? (
              <Empty title="Couldn't load audit logs" desc={(auditLogs.error as Error).message} />
            ) : (auditLogs.data ?? []).length === 0 ? (
              <Empty title="No activity yet" desc="Role assign/revoke events will appear here." />
            ) : (
              (auditLogs.data ?? []).map((l) => (
                <div key={l.id} className="rounded-2xl border border-border bg-card p-3.5 text-sm shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      l.action === "assign_role" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                    }`}>
                      {l.action === "assign_role" ? "Assigned" : "Revoked"}
                    </span>
                    <RoleBadge role={l.role} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1.5 text-xs">
                    <span className="font-semibold">{l.actor_email ?? l.actor_id.slice(0, 8)}</span>
                    <span className="text-muted-foreground"> {l.action === "assign_role" ? "→" : "×"} </span>
                    <span className="font-semibold">{l.target_email ?? l.target_user_id.slice(0, 8)}</span>
                  </div>
                  {l.notes && <div className="mt-1 text-xs text-muted-foreground">Note: {l.notes}</div>}
                </div>
              ))
            )}
          </div>
        ) : (
          <UICustomizer />
        )}
      </section>

      {manageUser && (
        <ManageRolesDialog
          user={manageUser}
          onClose={() => setManageUser(null)}
        />
      )}
    </main>
  );
}

function ManageRolesDialog({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const assign = useAssignRole();
  const revoke = useRevokeRole();
  const [role, setRole] = useState<AppRole>("store_owner");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const currentRoles = user.roles as AppRole[];
  const busy = assign.isPending || revoke.isPending;

  async function handleAssign() {
    setErr(null);
    try {
      await assign.mutateAsync({ targetUserId: user.user_id, role, notes: notes.trim() || undefined });
      setNotes("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  async function handleRevoke(r: AppRole) {
    setErr(null);
    try {
      await revoke.mutateAsync({ targetUserId: user.user_id, role: r, notes: notes.trim() || undefined });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold">Manage roles</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email ?? user.user_id}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current roles</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {currentRoles.length === 0 ? (
              <RoleBadge role="none" />
            ) : (
              currentRoles.map((r) => (
                <span key={r} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold">
                  {r.replace(/_/g, " ")}
                  <button
                    disabled={busy}
                    onClick={() => handleRevoke(r)}
                    className="grid h-4 w-4 place-items-center rounded-full bg-destructive/15 text-destructive hover:bg-destructive/25 disabled:opacity-50"
                    aria-label={`Revoke ${r}`}
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assign a role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AppRole)}
            className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
            ))}
          </select>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional note (saved to audit log)"
            className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            disabled={busy || currentRoles.includes(role)}
            onClick={handleAssign}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl gradient-primary px-3 py-2.5 text-sm font-bold text-primary-foreground shadow-sm disabled:opacity-50"
          >
            {assign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {currentRoles.includes(role) ? "Already assigned" : "Assign role"}
          </button>
          {err && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</div>}
        </div>
      </div>
    </div>
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

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    super_admin: "bg-indigo-600 text-white",
    store_owner: "bg-emerald-100 text-emerald-800",
    moderator: "bg-amber-100 text-amber-800",
    none: "bg-muted text-muted-foreground",
  };
  const label = role === "none" ? "no role" : role.replace(/_/g, " ");
  const cls = styles[role] ?? "bg-slate-200 text-slate-800";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

// -------- Product Requests Panel --------

type ProductRequest = {
  id: string;
  requested_by: string;
  name: string;
  description: string | null;
  price: number;
  images: string[];
  status: "pending" | "approved" | "rejected";
  reseller_price: number | null;
  admin_notes: string | null;
  created_at: string;
};

function useAllProductRequests() {
  return useQuery({
    queryKey: ["admin-product-requests"],
    queryFn: async (): Promise<ProductRequest[]> => {
      const { data, error } = await supabase
        .from("product_requests")
        .select("id, requested_by, name, description, price, images, status, reseller_price, admin_notes, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProductRequest[];
    },
  });
}

function ProductRequestsPanel() {
  const rq = useAllProductRequests();
  const rows = rq.data ?? [];
  const pending = rows.filter((r) => r.status === "pending");
  const others = rows.filter((r) => r.status !== "pending");

  if (rq.isLoading) return <Center><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></Center>;
  if (rq.error) return <Empty title="Couldn't load requests" desc={(rq.error as Error).message} />;
  if (rows.length === 0) return <Empty title="No requests" desc="Resellers haven't submitted any product requests yet." />;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Pending ({pending.length})</h3>
        {pending.length === 0 ? (
          <Empty title="All clear" desc="No pending requests." />
        ) : (
          pending.map((r) => <RequestCard key={r.id} row={r} />)
        )}
      </div>
      {others.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Recent</h3>
          {others.slice(0, 20).map((r) => <RequestCard key={r.id} row={r} readOnly />)}
        </div>
      )}
    </div>
  );
}

function RequestCard({ row, readOnly }: { row: ProductRequest; readOnly?: boolean }) {
  const qc = useQueryClient();
  const [resellerPrice, setResellerPrice] = useState<string>(
    row.reseller_price != null ? String(row.reseller_price) : String(row.price),
  );
  const [notes, setNotes] = useState<string>(row.admin_notes ?? "");

  const approve = useMutation({
    mutationFn: async () => {
      const price = Number(resellerPrice);
      if (!Number.isFinite(price) || price < 0) throw new Error("Enter a valid reseller price");
      await approveProductRequest({
        data: { request_id: row.id, reseller_price: price, admin_notes: notes.trim() || null },
      });
    },
    onSuccess: () => {
      toast.success("Approved & published to Reseller Products");
      qc.invalidateQueries({ queryKey: ["admin-product-requests"] });
      qc.invalidateQueries({ queryKey: ["reseller_products"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const reject = useMutation({
    mutationFn: async () => {
      await rejectProductRequest({
        data: { request_id: row.id, admin_notes: notes.trim() || null },
      });
    },
    onSuccess: () => {
      toast.success("Rejected — reseller will see the updated status");
      qc.invalidateQueries({ queryKey: ["admin-product-requests"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">{row.name}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Requested {new Date(row.created_at).toLocaleString()} · Base ৳{Number(row.price).toLocaleString()}
          </div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
          row.status === "approved" ? "bg-emerald-100 text-emerald-800"
          : row.status === "rejected" ? "bg-rose-100 text-rose-800"
          : "bg-amber-100 text-amber-800"
        }`}>{row.status}</span>
      </div>
      {row.description && <p className="mt-2 text-sm text-muted-foreground">{row.description}</p>}
      {row.images.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {row.images.map((u) => (
            <img key={u} src={u} alt="" className="h-20 w-20 rounded-md object-cover" />
          ))}
        </div>
      )}
      {!readOnly && (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
          <div>
            <label className="text-xs font-medium">Reseller price ৳</label>
            <input
              type="number"
              min={0}
              value={resellerPrice}
              onChange={(e) => setResellerPrice(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Admin note (optional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <button
            onClick={() => reject.mutate()}
            disabled={reject.isPending || approve.isPending}
            className="self-end rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50"
          >
            <X className="mr-1 inline h-4 w-4" /> Reject
          </button>
          <button
            onClick={() => approve.mutate()}
            disabled={approve.isPending || reject.isPending}
            className="self-end rounded-xl gradient-success px-3 py-2 text-sm font-bold text-success-foreground shadow-sm disabled:opacity-50"
          >
            <Check className="mr-1 inline h-4 w-4" /> Approve & Publish
          </button>
        </div>
      )}
      {readOnly && row.reseller_price != null && (
        <div className="mt-2 text-xs text-muted-foreground">Published at ৳{Number(row.reseller_price).toLocaleString()}</div>
      )}
      {readOnly && row.admin_notes && (
        <div className="mt-1 text-xs text-muted-foreground">Note: {row.admin_notes}</div>
      )}
    </div>
  );
}

