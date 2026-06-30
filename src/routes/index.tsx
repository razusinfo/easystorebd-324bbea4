import { createFileRoute, Link } from "@tanstack/react-router";
import { Store, ShieldCheck, Sparkles, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EazyStore — Launch and manage your mobile-first online store" },
      { name: "description", content: "EazyStore is a mobile-first SaaS to launch and manage your online store. Store Owner and Super Admin in one sleek platform." },
      { property: "og:title", content: "EazyStore — Launch and manage your mobile-first online store" },
      { property: "og:description", content: "Mobile-first SaaS to launch and manage your online store. Store Owner and Super Admin in one sleek platform." },
      { property: "og:url", content: "https://eazystorebd.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://eazystorebd.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "EazyStore",
              url: "https://eazystorebd.lovable.app/",
            },
            {
              "@type": "WebSite",
              name: "EazyStore",
              url: "https://eazystorebd.lovable.app/",
              description: "Mobile-first SaaS to launch and manage your online store.",
            },
          ],
        }),
      },
    ],
  }),
  component: Landing,
});

const NAV = ["Home", "Pricing", "Experts", "Funding", "Learn", "Affiliates", "About Us"];

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Top hero band — colors come from --gradient-landing / --landing-* tokens in src/styles.css */}
      <div className="gradient-landing relative overflow-hidden">
        <div className="absolute inset-0 -z-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.6),transparent_60%)]" />

        {/* Nav */}
        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="gradient-landing-brand grid h-9 w-9 place-items-center rounded-xl text-white shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-slate-900">
              eazy<span className="text-landing-accent">store</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-700 lg:flex">
            {NAV.map((n) => (
              <a key={n} href="#" className="hover:text-landing-accent transition">
                {n}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/auth"
              className="rounded-full border border-slate-300 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-800 backdrop-blur transition hover:bg-white"
            >
              Log In
            </Link>
            <Link
              to="/auth"
              className="bg-landing-accent hover:bg-landing-accent-hover rounded-full px-4 py-2 text-sm font-semibold text-white shadow-md transition sm:px-5"
            >
              Create Your Store
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="relative z-10 mx-auto max-w-4xl px-5 pb-20 pt-16 text-center sm:pt-24">
          <span className="border-landing-accent/40 text-landing-accent inline-flex items-center rounded-full border bg-white/70 px-4 py-1.5 text-xs font-semibold backdrop-blur sm:text-sm">
            No.1 Online business partner
          </span>

          <h1 className="mt-7 font-display text-4xl font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-6xl">
            EazyStore — Launch and manage
            <br />
            your mobile-first online store
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base text-slate-700 sm:text-lg">
            More than <span className="font-bold text-slate-900">100,000</span> entrepreneurs trust EazyStore
            <br className="hidden sm:block" />
            Transform your idea into an online business — fast and easy
          </p>

          <div className="mt-9 flex flex-col items-center gap-3">
            <Link
              to="/auth"
              className="group bg-landing-accent hover:bg-landing-accent-hover shadow-landing-accent inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold text-white transition"
            >
              Start for Free
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <p className="text-xs text-slate-600">(No credit card needed. No hidden fees.)</p>
          </div>
        </section>
      </div>


      {/* Role cards */}
      <section className="mx-auto -mt-10 grid max-w-6xl gap-4 px-5 pb-16 sm:grid-cols-2 sm:gap-6">
        <RoleCard
          to="/auth"
          icon={<Store className="h-6 w-6" />}
          tag="For founders"
          title="I'm a Store Owner"
          desc="Set up your store with our 4-step onboarding wizard and start listing products."
          cta="Start onboarding"
          gradient="from-indigo-500 to-blue-500"
        />
        <RoleCard
          to="/admin"
          icon={<ShieldCheck className="h-6 w-6" />}
          tag="For platform team"
          title="I'm a Super Admin"
          desc="Review registered stores and approve or reject pending product listings."
          cta="Open admin panel"
          gradient="from-sky-500 to-indigo-500"
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

