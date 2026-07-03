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
        href: "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Hind+Siliguri:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700&family=Sora:wght@600;700;800&family=Space+Grotesk:wght@600;700;800&display=swap",
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
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    registerPwa();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <SiteSettingsInjector />
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
