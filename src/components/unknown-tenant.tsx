import { Link } from "@tanstack/react-router";
import { Store as StoreIcon, ArrowRight } from "lucide-react";
import eazystoreLogo from "@/assets/eazystore-logo.png.asset.json";
import { EasyStoreWordmark } from "@/components/eazystore-wordmark";
import { buildSubdomainStorefrontUrl } from "@/lib/storefront-host";

type Props = {
  kind: "unknown-sub" | "unknown-custom";
  attempted?: string;
  host?: string;
};

export function UnknownTenant({ kind, attempted, host }: Props) {
  const label = kind === "unknown-sub" ? attempted : host;
  const suggestedUrl = attempted ? buildSubdomainStorefrontUrl(attempted) : null;

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-5">
        <a href="https://easystorebd.com" className="flex items-center gap-2">
          <img
            src={eazystoreLogo.url}
            alt="EasyStore"
            className="h-9 w-9 rounded-xl object-contain"
          />
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
            <>
              The store <span className="font-mono">{label}</span> doesn&apos;t exist
              or isn&apos;t published yet. It may have been renamed or removed.
            </>
          ) : (
            <>
              We couldn&apos;t match <span className="font-mono">{label}</span> to any
              active EasyStore storefront. If you&apos;re the owner, check your
              domain settings.
            </>
          )}
        </p>

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
        </div>

        {suggestedUrl && (
          <p className="mt-6 text-xs text-muted-foreground">
            Looking for a similar store? Try{" "}
            <a href={suggestedUrl} className="underline underline-offset-2">
              {suggestedUrl.replace(/^https?:\/\//, "")}
            </a>
          </p>
        )}
      </section>
    </main>
  );
}
