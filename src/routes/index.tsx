import { createFileRoute, Link } from "@tanstack/react-router";
import { Store, ShieldCheck, Sparkles, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EazyStore — Launch your store in minutes" },
      { name: "description", content: "EazyStore is a mobile-first SaaS to launch and manage your online store. Store Owner and Super Admin in one sleek platform." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 gradient-hero opacity-90" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.15),transparent_60%)]" />

        <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2 text-white">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 backdrop-blur">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">EazyStore</span>
          </div>
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
            v1.0 · Mobile-first
          </span>
        </header>

        <section className="mx-auto max-w-6xl px-5 pb-16 pt-8 text-white sm:pt-16">
          <h1 className="font-display text-4xl font-black leading-tight sm:text-6xl">
            Launch your store.
            <br />
            <span className="bg-gradient-to-r from-pink-300 to-amber-200 bg-clip-text text-transparent">
              In four taps.
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/80 sm:text-lg">
            A sleek SaaS platform for store owners and super admins. Pick a template, list your products, ship faster.
          </p>
        </section>
      </div>

      <section className="mx-auto -mt-10 grid max-w-6xl gap-4 px-5 pb-16 sm:grid-cols-2 sm:gap-6">
        <RoleCard
          to="/auth"
          icon={<Store className="h-6 w-6" />}
          tag="For founders"
          title="I'm a Store Owner"
          desc="Set up your store with our 4-step onboarding wizard and start listing products."
          cta="Start onboarding"
          gradient="from-indigo-500 to-fuchsia-500"
        />
        <RoleCard
          to="/admin"
          icon={<ShieldCheck className="h-6 w-6" />}
          tag="For platform team"
          title="I'm a Super Admin"
          desc="Review registered stores and approve or reject pending product listings."
          cta="Open admin panel"
          gradient="from-amber-500 to-rose-500"
        />
      </section>
    </main>
  );
}

function RoleCard({
  to, icon, tag, title, desc, cta, gradient,
}: {
  to: string; icon: React.ReactNode; tag: string; title: string; desc: string; cta: string; gradient: string;
}) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-lg transition hover:-translate-y-0.5 hover:shadow-glow"
    >
      <div className={`absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br ${gradient} opacity-20 blur-2xl transition group-hover:opacity-40`} />
      <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-md`}>
        {icon}
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tag}</p>
      <h3 className="mt-1 font-display text-2xl font-bold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
      <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
        {cta} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
