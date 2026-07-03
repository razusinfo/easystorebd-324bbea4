import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, ShoppingBag, Package, FolderTree, Users, Truck,
  Store, BarChart3, Palette, Wand2, LayoutTemplate, Smartphone,
  Megaphone, Tag, Settings, LogOut, ShieldCheck,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/lib/eazystore-data";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Orders", url: "/orders", icon: ShoppingBag },
  { title: "Products", url: "/products", icon: Package },
  { title: "Categories", url: "/categories", icon: FolderTree },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Courier", url: "/courier", icon: Truck, badge: "NEW" },
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

  async function signOut() {
    await supabase.auth.signOut();
    window.location.assign("/");
  }

  const renderItem = (item: { title: string; url: string; icon: any; badge?: string }) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild isActive={isActive(item.url)}>
        <Link to={item.url} className="flex items-center gap-2">
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 truncate">{item.title}</span>
              {item.badge && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                  {item.badge}
                </span>
              )}
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
            <span className="font-display text-lg font-black tracking-tight">
              EazyStore
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{mainItems.map(renderItem)}</SidebarMenu>
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
