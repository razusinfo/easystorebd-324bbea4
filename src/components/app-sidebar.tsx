import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, ShoppingBag, Package, FolderTree, Users, Truck,
  Store, BarChart3, Palette, Wand2, LayoutTemplate, Smartphone,
  Megaphone, Tag, Settings, LogOut, ShieldCheck, Repeat2, Receipt, Bell, MessageCircle,
  Send, Wallet,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/lib/eazystore-data";
import { useQuery } from "@tanstack/react-query";
import eazystoreLogo from "@/assets/eazystore-logo.png.asset.json";
import { EazyStoreWordmark } from "@/components/eazystore-wordmark";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Orders", url: "/orders", icon: ShoppingBag },
  { title: "Products", url: "/products", icon: Package },
  { title: "Categories", url: "/categories", icon: FolderTree },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Reseller Products", url: "/reseller-products", icon: Repeat2, badge: "NEW" },
  { title: "Reseller Requests", url: "/reseller-requests", icon: Send, badge: "NEW" },
  { title: "My Orders", url: "/my-orders", icon: Receipt, badge: "NEW" },
  { title: "Wallet", url: "/wallet", icon: Wallet, badge: "NEW" },
  { title: "Payouts", url: "/payouts", icon: Send, badge: "NEW" },
  { title: "Courier", url: "/courier", icon: Truck, badge: "NEW" },
  { title: "Notifications", url: "/my-notifications", icon: Bell },
];


const growthItems = [
  { title: "Manage Shop", url: "/manage-shop", icon: Store, badge: "NEW" },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Themes", url: "/themes", icon: Palette },
  { title: "Theme Builder", url: "/theme-builder", icon: Wand2, badge: "BETA" },
  { title: "Landing Pages", url: "/landing-pages", icon: LayoutTemplate, badge: "NEW" },
  { title: "Mobile App", url: "/mobile-app", icon: Smartphone },
  { title: "Spotlights", url: "/spotlights", icon: Megaphone, badge: "NEW" },
  { title: "Promo Codes", url: "/promo-codes", icon: Tag },
  { title: "SMS Settings", url: "/sms-settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isAdmin = useIsSuperAdmin();

  const isActive = (path: string) => pathname === path;

  // Unread notifications for the signed-in user — powers the sidebar badge.
  const unreadQ = useQuery({
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
  const unreadCount = unreadQ.data ?? 0;

  async function signOut() {
    await supabase.auth.signOut();
    window.location.assign("/");
  }

  const renderItem = (item: { title: string; url: string; icon: any; badge?: string | number }) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild isActive={isActive(item.url)}>
        <Link to={item.url} className="flex items-center gap-2">
          <div className="relative">
            <item.icon className="h-4 w-4 shrink-0" />
            {collapsed && typeof item.badge === "number" && item.badge > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </div>
          {!collapsed && (
            <>
              <span className="flex-1 truncate">{item.title}</span>
              {item.badge != null && (typeof item.badge === "string" ? (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                  {item.badge}
                </span>
              ) : item.badge > 0 ? (
                <span className="grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              ) : null)}
            </>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img
            src={eazystoreLogo.url}
            alt="EazyStore"
            className="h-8 w-8 shrink-0 rounded-lg object-contain"
          />
          {!collapsed && (
            <EazyStoreWordmark className="text-lg" />
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems
                .map((it) => it.url === "/my-notifications" ? { ...it, badge: unreadCount } : it)
                .map(renderItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Shop & Growth</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>{growthItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin.data && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>Admin</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {renderItem({ title: "Moderation", url: "/admin", icon: ShieldCheck })}
                {renderItem({ title: "Request Review", url: "/admin-requests", icon: Send, badge: "NEW" })}
                {renderItem({ title: "Orders to Fulfill", url: "/admin-reseller-orders", icon: Truck, badge: "NEW" })}
                {renderItem({ title: "Product Adopters", url: "/admin-reseller-adopters", icon: Users, badge: "NEW" })}
                {renderItem({ title: "Notifications", url: "/admin-notifications", icon: Bell })}
                {renderItem({ title: "Support Messages", url: "/admin-support", icon: MessageCircle })}
                {renderItem({ title: "Financial Overview", url: "/admin-financial", icon: Wallet, badge: "NEW" })}
                {renderItem({ title: "Payout Requests", url: "/admin-payouts", icon: Send, badge: "NEW" })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut}>
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sign out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
