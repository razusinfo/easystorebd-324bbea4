import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Persistent header bell that shows the current user's unread notification
 * count. Polls every 30s so the badge stays fresh across pages.
 */
export function HeaderNotificationsBell() {
  const q = useQuery({
    queryKey: ["user_notifications", "unread-count"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return 0;
      const { count, error } = await supabase
        .from("user_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .is("read_at", null);
      if (error) return 0;
      return count ?? 0;
    },
  });
  const count = q.data ?? 0;

  return (
    <Link
      to="/my-notifications"
      aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-muted"
    >
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
