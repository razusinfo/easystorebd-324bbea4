import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Crown, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/upgrade")({
  head: () => ({
    meta: [
      { title: "Upgrade Plan — EasyStore" },
      { name: "description", content: "Upgrade to Pro to unlock custom domains, unlimited products, and premium storefront features for your shop." },
    ],
  }),
  component: UpgradePage,
});

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "৳ 0",
    period: "/mo",
    features: [
      "Free .lovable.app domain",
      "Up to 20 products",
      "Basic storefront templates",
      "Community support",
    ],
    cta: "Current plan",
    disabled: true,
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "৳ 499",
    period: "/mo",
    features: [
      "Custom domain (yourshop.com)",
      "Unlimited products",
      "All premium templates",
      "Advanced analytics",
      "Priority support",
    ],
    cta: "Upgrade to Pro",
    disabled: false,
    highlight: true,
  },
  {
    id: "business",
    name: "Business",
    price: "৳ 1499",
    period: "/mo",
    features: [
      "Everything in Pro",
      "Multiple custom domains",
      "SMS + Email marketing",
      "Bulk import/export",
      "Dedicated manager",
    ],
    cta: "Upgrade to Business",
    disabled: false,
    highlight: false,
  },
];

function UpgradePage() {
  function subscribe(planId: string) {
    toast.info(
      `${planId.toUpperCase()} plan checkout coming soon — payment gateway integration in progress.`,
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl p-4 md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/manage-shop"
          className="grid h-9 w-9 place-items-center rounded-full border bg-card hover:bg-accent"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Upgrade your plan</h1>
          <p className="text-sm text-muted-foreground">
            Unlock custom domains and grow your shop with premium features.
          </p>
        </div>
      </div>

      <div className="mb-8 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <p>
          <strong>Custom domain</strong> is available on Pro and Business plans.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p.id}
            className={
              "relative flex flex-col rounded-2xl border bg-card p-6 " +
              (p.highlight ? "border-primary shadow-lg ring-1 ring-primary" : "")
            }
          >
            {p.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                Most popular
              </span>
            )}
            <div className="flex items-center gap-2">
              {p.highlight && <Crown className="h-5 w-5 text-primary" />}
              <h2 className="text-lg font-bold">{p.name}</h2>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold">{p.price}</span>
              <span className="text-sm text-muted-foreground">{p.period}</span>
            </div>
            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              className="mt-6 w-full"
              variant={p.highlight ? "default" : "outline"}
              disabled={p.disabled}
              onClick={() => subscribe(p.id)}
            >
              {p.cta}
            </Button>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Payments are processed securely. Cancel anytime. Prices in BDT, VAT included.
      </p>
    </main>
  );
}
