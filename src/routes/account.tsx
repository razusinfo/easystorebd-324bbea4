import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { User as SupaUser } from "@supabase/supabase-js";
import { UserCog, Package, Heart, Star, RotateCcw, LogOut, Loader2, BadgeCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My Account — EazyStore" },
      { name: "description", content: "Manage your EazyStore customer account." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AccountLayout,
});

type NavItem = {
  to: string;
  label: string;
  icon: typeof UserCog;
  exact?: boolean;
  children?: ReadonlyArray<{ to: string; label: string; hash?: string }>;
};

const NAV: ReadonlyArray<NavItem> = [
  {
    to: "/account",
    label: "Manage My Account",
    icon: UserCog,
    exact: true,
    children: [
      { to: "/account", label: "My Profile", hash: "profile" },
      { to: "/account", label: "Address Book", hash: "address" },
    ],
  },
  {
    to: "/account/orders",
    label: "My Orders",
    icon: Package,
    children: [
      { to: "/account/returns", label: "My Returns" },
      { to: "/account/returns", label: "My Cancellations" },
    ],
  },
  { to: "/account/wishlist", label: "Wishlist & Followed Stores", icon: Heart },
  { to: "/account/reviews", label: "My Reviews", icon: Star },
  { to: "/account/returns", label: "Returns & Cancellations", icon: RotateCcw },
];

function AccountLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupaUser | null | undefined>(undefined);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUser(s?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user === null) navigate({ to: "/", replace: true });
  }, [user, navigate]);

  if (user === undefined) {
    return (
      <main className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }
  if (!user) return null;

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email ||
    "Customer";

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row">
        <aside className="md:w-60 shrink-0">
          <div className="mb-4">
            <p className="text-sm text-foreground">Hello, <span className="font-medium">{displayName}</span></p>
            <span className="mt-2 inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">
              <BadgeCheck className="h-3.5 w-3.5" /> Verified Account
            </span>
          </div>
          <nav className="flex flex-col gap-3 text-sm">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <div key={item.to} className="flex flex-col">
                  <Link
                    to={item.to as "/account"}
                    className={`font-semibold ${active ? "text-primary" : "text-foreground hover:text-primary"}`}
                  >
                    {item.label}
                  </Link>
                  {item.children && (
                    <div className="mt-2 flex flex-col gap-2 pl-4">
                      {item.children.map((c) => (
                        <Link
                          key={`${c.to}-${c.label}`}
                          to={c.to as "/account"}
                          hash={c.hash}
                          className="text-muted-foreground hover:text-primary"
                        >
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-auto justify-start p-0 text-sm font-normal text-muted-foreground hover:bg-transparent hover:text-destructive"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/", replace: true });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </nav>
        </aside>

        <section className="flex-1 min-w-0">
          <Outlet />
        </section>
      </div>
    </main>
  );
}
