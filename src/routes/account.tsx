import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { User as SupaUser } from "@supabase/supabase-js";
import { UserCog, Package, Heart, Star, RotateCcw, LogOut, Loader2, ShoppingCart, Store as StoreIcon, Twitter, Youtube, Instagram, Facebook } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { usePublicStoreBySlug, logoAlignClass, logoStyle, getTemplateSettings, DEFAULT_FOOTER, type FooterSettings } from "@/lib/eazystore-data";
import { useStoreCart, cartCount } from "@/lib/cart-store";
import { CustomerAuth } from "@/components/storefront/customer-auth";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My Account — EasyStore" },
      { name: "description", content: "Manage your EasyStore customer account." },
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
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    try { setStoreSlug(window.localStorage.getItem("last_store_slug")); } catch { /* ignore */ }
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

  const inner = (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 md:flex-row">
      <aside className="md:w-64">
        <div className="rounded-2xl border bg-background p-4 shadow-sm">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Signed in as</p>
            <p className="truncate font-semibold">{displayName}</p>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <div key={item.to}>
                  <Link
                    to={item.to as "/account"}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                      active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                  {active && item.children && (
                    <div className="ml-9 mt-1 flex flex-col gap-1">
                      {item.children.map((c) => (
                        <Link
                          key={`${c.to}-${c.label}`}
                          to={c.to as "/account"}
                          hash={c.hash}
                          className="rounded px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
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
              className="mt-2 justify-start text-sm text-destructive hover:text-destructive"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/", replace: true });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </nav>
        </div>
      </aside>

      <section className="flex-1">
        <div className="rounded-2xl border bg-background p-6 shadow-sm">
          <Outlet />
        </div>
      </section>
    </div>
  );

  if (storeSlug) {
    return <StorefrontChrome slug={storeSlug}>{inner}</StorefrontChrome>;
  }
  return <main className="min-h-screen bg-muted/30">{inner}</main>;
}

const SOCIAL_ICONS = { twitter: Twitter, youtube: Youtube, instagram: Instagram, facebook: Facebook } as const;
const FOOTER_LABEL_SUB: Record<string, string> = {
  "Home": "", "Company": "", "About Us": "about", "Team": "team",
  "Products": "products", "Blogs": "blogs", "Pricing": "pricing", "Contact": "contact",
};

function StorefrontChrome({ slug, children }: { slug: string; children: React.ReactNode }) {
  const q = usePublicStoreBySlug(slug);
  const store = q.data?.store;
  const items = useStoreCart(store?.id);
  const count = cartCount(items);
  const name = (store?.name ?? "EASYSTORE").toUpperCase();
  const logo = q.data?.logoUrl ?? null;

  const tpl = getTemplateSettings(store, store?.template ?? "eazystore-basic");
  const f: Required<FooterSettings> = {
    showNav: tpl.footer?.showNav ?? DEFAULT_FOOTER.showNav,
    navLinks: tpl.footer?.navLinks ?? DEFAULT_FOOTER.navLinks,
    showSocials: tpl.footer?.showSocials ?? DEFAULT_FOOTER.showSocials,
    socials: tpl.footer?.socials ?? DEFAULT_FOOTER.socials,
    showCopyright: tpl.footer?.showCopyright ?? DEFAULT_FOOTER.showCopyright,
  };
  const enabledLinks = f.navLinks.filter((l) => l.enabled && l.label !== "Blogs" && l.label !== "Pricing");
  const enabledSocials = f.socials.filter((s) => s.enabled);
  const hasFooter = (f.showNav && enabledLinks.length > 0) || (f.showSocials && enabledSocials.length > 0) || f.showCopyright;

  return (
    <div className="eazystore-basic-scope min-h-screen bg-neutral-100 font-sans text-neutral-900">
      <style dangerouslySetInnerHTML={{ __html: `.eazystore-basic-scope { --acc: #5B21B6; --acc-rgb: 91,33,182; } .eazystore-basic-scope .acc-bg { background-color: var(--acc); } .eazystore-basic-scope .acc-text { color: var(--acc); } .eazystore-basic-scope .acc-soft { background-color: rgba(var(--acc-rgb), 0.10); color: var(--acc); } .eazystore-basic-scope .hover\\:acc-text:hover { color: var(--acc); } .eazystore-basic-scope .hover\\:acc-soft:hover { background-color: rgba(var(--acc-rgb), 0.18); }` }} />
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <Link to="/s/$slug" params={{ slug }} className={`flex min-w-0 flex-1 items-center gap-2 sm:gap-3 ${logoAlignClass(store?.shop_settings)}`}>
            {logo ? (
              <img src={logo} alt={`${name} logo`} style={logoStyle(store?.shop_settings)} className="shrink-0 object-contain" />
            ) : (
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-neutral-900 sm:h-14 sm:w-14">
                <StoreIcon className="h-5 w-5 text-white" />
              </div>
            )}
            <h1 className="hidden text-xl font-bold sm:block">{name}</h1>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/s/$slug"
              params={{ slug }}
              className="acc-bg relative grid h-11 w-11 place-items-center rounded-full text-white shadow-md"
              aria-label="Shop"
            >
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-white px-1 text-[11px] font-black text-neutral-900 shadow ring-2 ring-white">
                  {count}
                </span>
              )}
            </Link>
            <CustomerAuth />
          </div>
        </div>
      </header>

      {children}

      {hasFooter && (
        <footer className="mt-10 border-t border-neutral-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-14">
            {f.showNav && enabledLinks.length > 0 && (
              <nav className="grid grid-cols-2 gap-x-4 gap-y-2 text-center sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-12 sm:gap-y-3">
                {enabledLinks.map((l) => {
                  const displayLabel = l.label === "Company" ? "Home" : l.label;
                  const cls = "font-display text-sm font-bold text-neutral-900 transition hover:acc-text sm:text-lg";
                  if (l.href && l.href.trim()) {
                    return <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className={cls}>{displayLabel}</a>;
                  }
                  const sub = FOOTER_LABEL_SUB[l.label];
                  if (sub !== undefined) {
                    return <Link key={l.label} to={sub ? `/s/${slug}/${sub}` : `/s/${slug}`} className={cls}>{displayLabel}</Link>;
                  }
                  return <span key={l.label} className={cls}>{displayLabel}</span>;
                })}
              </nav>
            )}
            {f.showSocials && enabledSocials.length > 0 && (
              <div className={`${f.showNav && enabledLinks.length > 0 ? "mt-6 sm:mt-8" : ""} flex items-center justify-center gap-3 sm:gap-6`}>
                {enabledSocials.map((s) => {
                  const Icon = SOCIAL_ICONS[s.key];
                  return (
                    <a key={s.key} href={s.url || "#"} target={s.url ? "_blank" : undefined} rel={s.url ? "noreferrer" : undefined} aria-label={s.key} className="grid h-9 w-9 place-items-center rounded-full text-neutral-700 transition hover:acc-soft sm:h-10 sm:w-10">
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </a>
                  );
                })}
              </div>
            )}
            {f.showCopyright && (
              <p className={`${(f.showNav && enabledLinks.length > 0) || (f.showSocials && enabledSocials.length > 0) ? "mt-6 sm:mt-8" : ""} text-center text-sm font-medium text-neutral-700 sm:text-base`}>
                Copyright © {new Date().getFullYear()} {name}
              </p>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
