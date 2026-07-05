import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, PackageX, CheckCheck, Bell, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/my-notifications")({
  component: MyNotificationsPage,
});

type Notif = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  related_id: string | null;
  read_at: string | null;
  created_at: string;
};

function MyNotificationsPage() {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["user_notifications", "me"],
    queryFn: async (): Promise<Notif[]> => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return [];
      const { data, error } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Notif[];
    },
  });

  const markOne = useMutation({
    mutationFn: async (id: string) => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Not signed in");
      const { error } = await supabase
        .from("user_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", uid); // scope to my rows only
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_notifications", "me"] }),
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const markAll = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Not signed in");
      const { error } = await supabase
        .from("user_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", uid)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_notifications", "me"] }),
  });

  const [filter, setFilter] = useState<"all" | "unread" | "approved" | "rejected">("all");
  const allRows = q.data ?? [];
  const unread = allRows.filter((r) => !r.read_at).length;
  const rows = allRows.filter((r) => {
    if (filter === "unread") return !r.read_at;
    if (filter === "approved") return r.type === "product_request_approved";
    if (filter === "rejected") return r.type === "product_request_rejected";
    return true;
  });

  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Bell className="h-5 w-5" /> Notifications
          {unread > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              {unread}
            </span>
          )}
        </h1>
        <button
          className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          disabled={unread === 0 || markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          <CheckCheck className="mr-1 inline h-3.5 w-3.5" /> Mark all read
        </button>
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notifications yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((n) => (
            <NotificationCard key={n.id} n={n} onMarkRead={() => markOne.mutate(n.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function NotificationCard({
  n,
  onMarkRead,
}: {
  n: Notif;
  onMarkRead: () => void;
}) {
  const isRevoked = n.type === "supplier_revoked";
  const isLowStock =
    n.type === "supplier_out_of_stock" || n.type === "supplier_low_stock";
  const Icon = isRevoked ? PackageX : isLowStock ? AlertTriangle : Bell;
  const tone = isRevoked
    ? "border-destructive/40 bg-destructive/5"
    : isLowStock
      ? "border-warning/40 bg-warning/5"
      : "border-border bg-card";

  return (
    <li
      data-testid={`notification-${n.type}`}
      className={`rounded-xl border p-3 shadow-sm ${tone} ${n.read_at ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{n.title}</div>
          {n.body && (
            <div className="mt-0.5 text-xs text-muted-foreground">{n.body}</div>
          )}
          <div className="mt-2 flex items-center gap-3">
            {n.link && (
              <Link
                to={n.link}
                className="text-xs font-semibold text-primary underline underline-offset-2"
              >
                {isRevoked ? "View my products" : "Open"}
              </Link>
            )}
            {!n.read_at && (
              <button
                type="button"
                className="text-xs text-muted-foreground underline"
                onClick={onMarkRead}
              >
                Mark as read
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
