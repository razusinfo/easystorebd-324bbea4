import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Package, ShoppingBag, Bell, Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const items = [
  { title: "হোম", url: "/dashboard", icon: LayoutDashboard },
  { title: "পণ্য", url: "/products", icon: Package },
  { title: "অর্ডার", url: "/orders", icon: ShoppingBag },
  { title: "নোটিফ", url: "/my-notifications", icon: Bell, showBadge: true },
];

export function MobileBottomNav() {
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const unreadQ = useQuery({
    queryKey: ["user_notifications", "unread-count"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return 0;
      const { count } = await supabase
        .from("user_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .is("read_at", null);
      return count ?? 0;
    },
  });
  const unread = unreadQ.data ?? 0;

  if (!isMobile) return null;

  return (
    <>
      {/* spacer so page content isn't hidden behind the fixed bar */}
      <div aria-hidden className="h-16 md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-border bg-background/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary mobile navigation"
      >
        {items.map((it) => {
          const active = pathname === it.url || pathname.startsWith(it.url + "/");
          return (
            <Link
              key={it.url}
              to={it.url}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium",
                active ? "text-primary" : "text-muted-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <div className="relative">
                <it.icon className="h-5 w-5" />
                {it.showBadge && unread > 0 && (
                  <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </div>
              <span className="truncate">{it.title}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className="flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium text-muted-foreground"
          aria-label="সব মেনু খুলুন"
        >
          <Menu className="h-5 w-5" />
          <span>মেনু</span>
        </button>
      </nav>
    </>
  );
}
