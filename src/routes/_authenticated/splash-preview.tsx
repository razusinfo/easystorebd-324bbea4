import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, RefreshCw, Loader2, Info } from "lucide-react";
import {
  useMyStore,
  useLogoSignedUrl,
  slugifyStoreName,
} from "@/lib/eazystore-data";
import { SplashFrame } from "@/components/splash-frame";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/splash-preview")({
  head: () => ({
    meta: [
      { title: "Splash Preview — EasyStore" },
      {
        name: "description",
        content:
          "Preview how your storefront's loading splash renders on your subdomain and custom domain before publishing.",
      },
    ],
  }),
  component: SplashPreviewPage,
});

function SplashPreviewPage() {
  const storeQ = useMyStore();
  const [dark, setDark] = useState(false);
  const [coldCache, setColdCache] = useState(false);
  const [slow, setSlow] = useState(false);

  const splashCfg = storeQ.data?.shop_settings?.splash ?? {};
  const splashPath = (splashCfg as any).logo_path ?? null;
  const onSub = (splashCfg as any).on_subdomain ?? true;
  const onCd = (splashCfg as any).on_custom_domain ?? true;

  const signedSplash = useLogoSignedUrl(splashPath);
  const signedLogo = useLogoSignedUrl(storeQ.data?.logo_url ?? null);

  const store = storeQ.data;
  const slug = store ? store.slug || slugifyStoreName(store.name) : "";
  const custom = store?.custom_domain?.trim() || null;
  const subHost = slug ? `${slug}.easystorebd.com` : "";

  const splashUrl = useMemo(() => {
    if (coldCache) return null;
    return signedSplash.data ?? null;
  }, [signedSplash.data, coldCache]);

  const logoUrl = useMemo(() => {
    if (coldCache) return null;
    return signedLogo.data ?? null;
  }, [signedLogo.data, coldCache]);

  const subLogo = onSub ? splashUrl ?? logoUrl : logoUrl;
  const cdLogo = onCd ? splashUrl ?? logoUrl : logoUrl;

  if (storeQ.isLoading) {
    return (
      <main className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }
  if (!store) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-5 text-center">
        <p className="text-sm text-muted-foreground">No store yet.</p>
      </main>
    );
  }

  const loading = slow && (signedSplash.isLoading || signedLogo.isLoading);

  return (
    <main className="mx-auto w-full max-w-5xl p-4 md:p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            to="/manage-shop"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Manage Shop
          </Link>
          <h1 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight">
            Splash Preview
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            How your storefront's loading splash will render on each enabled
            surface. Changes made in Shop Settings appear here after save.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            signedSplash.refetch();
            signedLogo.refetch();
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <section className="rounded-xl border bg-card p-4 flex flex-wrap gap-4">
        <ToggleRow label="Dark background" checked={dark} onChange={setDark} />
        <ToggleRow
          label="Cold cache (simulate first visit)"
          checked={coldCache}
          onChange={setColdCache}
        />
        <ToggleRow
          label="Slow 3G (show empty state)"
          checked={slow}
          onChange={setSlow}
        />
      </section>

      {!splashPath && (
        <div className="rounded-xl border border-amber-400/50 bg-amber-50 dark:bg-amber-950/40 p-4 flex gap-3 text-sm">
          <Info className="h-5 w-5 shrink-0 text-amber-600" />
          <div>
            No dedicated splash logo uploaded — the preview falls back to your
            storefront logo. Upload one in{" "}
            <Link to="/manage-shop" className="underline font-medium">
              Shop Settings
            </Link>
            .
          </div>
        </div>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <ScopeCard
          title="Subdomain"
          host={subHost}
          enabled={onSub}
          liveUrl={`https://${subHost}`}
        >
          <div className="grid gap-4 sm:grid-cols-2 place-items-center">
            <SplashFrame
              preset="mobile"
              logoUrl={subLogo}
              dark={dark}
              loading={loading}
              label="Mobile"
            />
            <SplashFrame
              preset="desktop"
              logoUrl={subLogo}
              dark={dark}
              loading={loading}
              label="Desktop"
            />
          </div>
        </ScopeCard>

        {custom ? (
          <ScopeCard
            title="Custom Domain"
            host={custom}
            enabled={onCd}
            liveUrl={`https://${custom}`}
          >
            <div className="grid gap-4 sm:grid-cols-2 place-items-center">
              <SplashFrame
                preset="mobile"
                logoUrl={cdLogo}
                dark={dark}
                loading={loading}
                label="Mobile"
              />
              <SplashFrame
                preset="desktop"
                logoUrl={cdLogo}
                dark={dark}
                loading={loading}
                label="Desktop"
              />
            </div>
          </ScopeCard>
        ) : (
          <div className="rounded-xl border border-dashed p-6 grid place-items-center text-center text-sm text-muted-foreground">
            <div>
              No custom domain attached yet.{" "}
              <Link to="/domain-settings" className="underline">
                Add one
              </Link>{" "}
              to preview its splash here.
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <Switch checked={checked} onCheckedChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

function ScopeCard({
  title,
  host,
  enabled,
  liveUrl,
  children,
}: {
  title: string;
  host: string;
  enabled: boolean;
  liveUrl: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <div className="text-xs text-muted-foreground font-mono">{host}</div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full ${
              enabled
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {enabled ? "Splash enabled" : "Splash disabled"}
          </span>
          <a
            href={liveUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Open <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
      {children}
    </div>
  );
}
