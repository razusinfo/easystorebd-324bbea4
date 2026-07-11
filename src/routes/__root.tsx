import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { useSiteSettings, useSignedSiteAsset } from "@/lib/site-settings";
import { registerPwa } from "@/lib/pwa-register";
import { supabase } from "@/integrations/supabase/client";
import { PullToRefresh } from "@/components/pull-to-refresh";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-8xl font-black text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">পেজ খুঁজে পাওয়া যায়নি</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-lg gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:shadow-glow transition"
          >
            হোমে ফিরুন
          </a>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">এই পেজটি লোড হয়নি</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong. Try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-lg gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            আবার চেষ্টা করুন
          </button>
          <a href="/" className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold">
            হোম
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#6366F1" },
      { title: "EazyStore — Launch your store in minutes" },
      { name: "description", content: "EazyStore is a mobile-first SaaS to launch and manage your online store — 4-step onboarding, products, and admin moderation in one sleek platform." },
      { property: "og:site_name", content: "EazyStore" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "EazyStore — Launch your store in minutes" },
      { property: "og:description", content: "Mobile-first SaaS to launch and manage your online store — onboarding, products, and admin moderation in one sleek platform." },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "EazyStore — Launch your store in minutes" },
      { name: "twitter:description", content: "Mobile-first SaaS to launch and manage your online store — onboarding, products, and admin moderation in one sleek platform." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/pwa-icon-180.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/pwa-icon-16.png" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/pwa-icon-32.png" },
      { rel: "icon", type: "image/png", sizes: "48x48", href: "/pwa-icon-48.png" },
      { rel: "icon", type: "image/png", sizes: "64x64", href: "/pwa-icon-64.png" },
      { rel: "icon", type: "image/png", sizes: "96x96", href: "/pwa-icon-96.png" },
      { rel: "icon", type: "image/png", sizes: "144x144", href: "/pwa-icon-144.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/pwa-icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "256x256", href: "/pwa-icon-256.png" },
      { rel: "icon", type: "image/png", sizes: "384x384", href: "/pwa-icon-384.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/pwa-icon-512.png" },
      { rel: "shortcut icon", href: "/pwa-icon-192.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Hind+Siliguri:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700&family=Playfair+Display:wght@700;800;900&family=Sora:wght@600;700;800&family=Space+Grotesk:wght@600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="bn">
      <head>
        <HeadContent />
        <style
          // Full-screen page-load splash. Fades out once the app hydrates.
          dangerouslySetInnerHTML={{
            __html: `
              #app-splash{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#1E1B4B;transition:opacity .35s ease;}
              #app-splash img{width:min(60vw,60vh);height:auto;object-fit:contain;filter:drop-shadow(0 8px 32px rgba(0,0,0,.35));animation:app-splash-pulse 1.4s ease-in-out infinite;}
              #app-splash.hide{opacity:0;pointer-events:none;}
              @keyframes app-splash-pulse{0%,100%{transform:scale(1);opacity:.95}50%{transform:scale(1.04);opacity:1}}
            `,
          }}
        />
      </head>
      <body>
        <div id="app-splash" aria-hidden="true">
          <img id="app-splash-img" src="/__l5e/assets-v1/99cfd954-72ad-4e47-aa73-ca0fe57827d3/easystore-logo.png" alt="" />
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var m = location.pathname.match(/^\\/s\\/([a-z0-9-]+)/i);
                  if (!m) return;
                  var slug = m[1].toLowerCase();
                  var logo = localStorage.getItem("storefront_logo_cache:" + slug);
                  var img = document.getElementById("app-splash-img");
                  var splash = document.getElementById("app-splash");
                  if (logo && img) {
                    img.src = logo;
                    img.style.width = "min(40vw,40vh)";
                    img.style.borderRadius = "24px";
                    if (splash) splash.style.background = "#ffffff";
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
        {children}
        <Scripts />
      </body>

    </html>
  );
}


function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    registerPwa();
    // Fade out the initial full-screen splash after the app is mounted.
    const el = document.getElementById("app-splash");
    if (el) {
      const t = window.setTimeout(() => {
        el.classList.add("hide");
        window.setTimeout(() => el.remove(), 400);
      }, 300);
      return () => window.clearTimeout(t);
    }
  }, []);

  // Reset per-user cache on real identity transitions (a different user signs
  // in, or the previous user signs out). Preserve shopper-facing browser state
  // like the persisted cart and theme so signing in mid-checkout doesn't wipe
  // it. USER_UPDATED (profile/email edits) is intentionally ignored.
  useEffect(() => {
    let lastUserId: string | null | undefined;
    supabase.auth.getSession().then(({ data }) => {
      lastUserId = data.session?.user?.id ?? null;
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT") return;
      const nextUserId = session?.user?.id ?? null;
      if (nextUserId === lastUserId) return;
      lastUserId = nextUserId;
      queryClient.cancelQueries();
      queryClient.clear();
      router.invalidate();
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient, router]);



  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <SiteSettingsInjector />
          <PullToRefresh />
          <Outlet />

        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/** Applies site-wide primary color and favicon from the site_settings table. */
function SiteSettingsInjector() {
  const s = useSiteSettings();
  const favicon = useSignedSiteAsset(s.data?.favicon_url);
  const primary = s.data?.primary_color;

  useEffect(() => {
    if (!primary) return;
    document.documentElement.style.setProperty("--primary", primary);
    document.documentElement.style.setProperty("--sidebar-primary", primary);
  }, [primary]);

  useEffect(() => {
    const href = favicon.data;
    if (!href) return;
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [favicon.data]);

  return null;
}
