import { Link } from "@tanstack/react-router";
import { Store as StoreIcon, ArrowRight, LifeBuoy } from "lucide-react";
import eazystoreLogo from "@/assets/eazystore-logo.png.asset.json";
import { EasyStoreWordmark } from "@/components/eazystore-wordmark";
import { buildSubdomainStorefrontUrl } from "@/lib/storefront-host";

type Props = {
  kind: "unknown-sub" | "unknown-custom";
  attempted?: string;
  host?: string | null;
  suggestions?: Array<{ slug: string; name: string }>;
};

export function UnknownTenant({ kind, attempted, host, suggestions = [] }: Props) {
  const label = kind === "unknown-sub" ? attempted : host;
  const suggestedUrl = attempted ? buildSubdomainStorefrontUrl(attempted) : null;
  const detectedHost = host ?? (kind === "unknown-sub" && attempted ? `${attempted}.easystorebd.com` : undefined);
  const supportSubject = encodeURIComponent(
    kind === "unknown-sub"
      ? `Store not found: ${attempted}`
      : `Custom domain not connected: ${host}`,
  );
  const supportBody = encodeURIComponent(
    `Detected host: ${detectedHost ?? "unknown"}\nKind: ${kind}\nAttempted slug: ${attempted ?? "-"}`,
  );

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-5">
        <a href="https://easystorebd.com" className="flex items-center gap-2">
          <img src={eazystoreLogo.url} alt="EasyStore" className="h-9 w-9 rounded-xl object-contain" />
          <EasyStoreWordmark className="text-lg" />
        </a>
      </header>

      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <StoreIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">
          {kind === "unknown-sub"
            ? `"${label}" নামের কোনো ষ্টোর খুঁজে পাওয়া যায়নি`
            : `এই ডোমেইন এখনো কোনো ষ্টোরের সাথে যুক্ত নেই`}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          {kind === "unknown-sub" ? (
            <>The store <span className="font-mono">{label}</span> doesn&apos;t exist or isn&apos;t published yet.</>
          ) : (
            <>We couldn&apos;t match <span className="font-mono">{label}</span> to any active EasyStore storefront.</>
          )}
        </p>

        {detectedHost && (
          <p className="mt-2 text-xs text-muted-foreground">
            Detected hostname: <span className="font-mono">{detectedHost}</span>
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href="https://easystorebd.com"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
          >
            Go to easystorebd.com
            <ArrowRight className="h-4 w-4" />
          </a>
          <Link
            to="/stores"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-input bg-background px-5 py-3 text-sm font-semibold hover:bg-muted"
          >
            Browse stores
          </Link>
          <a
            href={`mailto:support@easystorebd.com?subject=${supportSubject}&body=${supportBody}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-input bg-background px-5 py-3 text-sm font-semibold hover:bg-muted"
          >
            <LifeBuoy className="h-4 w-4" />
            Contact support
          </a>
        </div>

        {suggestions.length > 0 && (
          <div className="mt-10 w-full">
            <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Suggested stores</p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {suggestions.map((s) => {
                const url = buildSubdomainStorefrontUrl(s.slug);
                if (!url) return null;
                return (
                  <li key={s.slug}>
                    <a
                      href={url}
                      className="flex items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm hover:bg-muted"
                    >
                      <span className="truncate font-medium">{s.name}</span>
                      <span className="ml-2 truncate font-mono text-xs text-muted-foreground">{s.slug}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {suggestedUrl && (
          <p className="mt-6 text-xs text-muted-foreground">
            Did you mean{" "}
            <a href={suggestedUrl} className="underline underline-offset-2">
              {suggestedUrl.replace(/^https?:\/\//, "")}
            </a>
            ?
          </p>
        )}
      </section>
    </main>
  );
}
