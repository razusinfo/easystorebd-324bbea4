import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SupportChatWidget } from "@/components/support-chat-widget";

// Routes reachable BEFORE a store exists (avoid a redirect loop).
const NO_STORE_ALLOWED = ["/onboarding", "/upgrade"];

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }

    // Store guard: any authenticated user without a store of their own goes
    // to onboarding. Scoped strictly by owner_user_id so no other user's
    // store can satisfy this check.
    const path = location.pathname;
    if (!NO_STORE_ALLOWED.some((p) => path.startsWith(p))) {
      const { data: store } = await supabase
        .from("stores")
        .select("id")
        .eq("owner_user_id", data.user.id)
        .limit(1)
        .maybeSingle();
      if (!store) throw redirect({ to: "/onboarding" });
    }

    return { user: data.user };
  },
  component: AuthenticatedLayout,
});


function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  // Onboarding has its own full-screen flow — skip the sidebar shell there.
  if (pathname.startsWith("/onboarding")) return <Outlet />;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur">
            <SidebarTrigger />
          </header>
          <main className="min-w-0 flex-1 overflow-x-hidden">
            <div className="mx-auto w-full max-w-7xl">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}


