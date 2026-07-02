import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Store,
  Package,
  BarChart3,
  Truck,
  Palette,
  CreditCard,
  ArrowRight,
  Check,
  ShoppingCart,
  ShieldCheck,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Facebook,
  Youtube,
  Instagram,
  Linkedin,
  Menu,
  X,
} from "lucide-react";
import { getStorefrontSlugFromHost } from "@/lib/storefront-host";
import { StorefrontView } from "@/components/storefront-view";
import heroAsset from "@/assets/hero-storefront.jpg.asset.json";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EazyStore — Build your online store in minutes" },
      {
        name: "description",
        content:
          "EazyStore gives every merchant a beautiful storefront, powerful dashboard and local payments — no code, no hassle. Just sell.",
      },
      { property: "og:title", content: "EazyStore — Build your online store in minutes" },
      {
        property: "og:description",
        content:
          "Beautiful storefront, powerful dashboard and local payments (COD, bKash, Nagad). Launch in minutes.",
      },
      { property: "og:image", content: `https://eazystorebd.lovable.app${heroAsset.url}` },
      { property: "og:url", content: "https://eazystorebd.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://eazystorebd.lovable.app/" }],
  }),
  component: Landing,
});

function Landing() {
  const subSlug =
    typeof window !== "undefined" ? getStorefrontSlugFromHost(window.location.hostname) : null;
  if (subSlug) return <StorefrontView slug={subSlug} />;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopBand />
      <Features />
      <HowItWorks />
      <Pricing />
      <CtaBanner />
      <Footer />
    </main>
  );
}

/* ---------------- Top band: nav + hero ---------------- */

function TopBand() {
  const [open, setOpen] = useState(false);
  return (
    <div className="gradient-landing relative overflow-hidden">
      <div className="absolute inset-0 -z-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.7),transparent_60%)]" />

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <div className="gradient-landing-brand grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-md">
            <Store className="h-5 w-5" />
          </div>
          <span className="font-hero truncate text-lg tracking-tight text-slate-900 sm:text-xl">EazyStore</span>
        </Link>

        <nav className="hidden items-center gap-9 text-sm font-medium text-slate-700 md:flex">
          <a href="#features" className="hover:text-landing-accent transition">Features</a>
          <a href="#pricing" className="hover:text-landing-accent transition">Pricing</a>
          <a href="#how" className="hover:text-landing-accent transition">How it works</a>
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            to="/auth"
            className="hidden text-sm font-semibold text-slate-800 hover:text-landing-accent sm:inline"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            className="bg-landing-accent hover:bg-landing-accent-hover hidden rounded-full px-4 py-2 text-sm font-semibold text-white shadow-md transition sm:inline-flex sm:px-5"
          >
            Create your store
          </Link>

          {/* Mobile menu trigger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Open menu"
                className="grid h-10 w-10 place-items-center rounded-full border border-slate-300 bg-white/80 text-slate-800 md:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 max-w-[85vw] p-0">
              <SheetHeader className="border-b border-emerald-100 p-5">
                <SheetTitle className="flex items-center gap-2">
                  <div className="gradient-landing-brand grid h-8 w-8 place-items-center rounded-lg text-white">
                    <Store className="h-4 w-4" />
                  </div>
                  <span className="font-hero text-slate-900">EazyStore</span>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col p-4 text-base font-medium text-slate-800">
                <a onClick={() => setOpen(false)} href="#features" className="rounded-lg px-3 py-3 hover:bg-emerald-50">Features</a>
                <a onClick={() => setOpen(false)} href="#pricing" className="rounded-lg px-3 py-3 hover:bg-emerald-50">Pricing</a>
                <a onClick={() => setOpen(false)} href="#how" className="rounded-lg px-3 py-3 hover:bg-emerald-50">How it works</a>
              </nav>
              <div className="mt-auto space-y-2 border-t border-emerald-100 p-4">
                <Link to="/auth" onClick={() => setOpen(false)} className="block rounded-full border border-slate-300 py-3 text-center text-sm font-semibold text-slate-800">Sign in</Link>
                <Link to="/auth" onClick={() => setOpen(false)} className="bg-landing-accent hover:bg-landing-accent-hover block rounded-full py-3 text-center text-sm font-semibold text-white">Create your store</Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Hero split */}
      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-8 sm:px-8 sm:pb-24 sm:pt-10 lg:grid-cols-2 lg:pt-16">
        <div>
          <span className="border-landing-accent/40 text-landing-accent inline-flex items-center gap-2 rounded-full border bg-white/70 px-4 py-1.5 text-xs font-semibold backdrop-blur sm:text-sm">
            <span className="bg-landing-accent inline-block h-1.5 w-1.5 rounded-full" />
            The e-commerce builder for modern merchants
          </span>

          <h1 className="mt-6 font-hero text-3xl leading-[1.05] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Build your <span className="text-landing-accent">online store</span> in minutes.
          </h1>

          <p className="mt-5 max-w-lg text-base text-slate-700 sm:text-lg">
            EazyStore gives every merchant a beautiful storefront, powerful dashboard and local
            payments — no code, no hassle. Just sell.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/auth"
              className="group bg-landing-accent hover:bg-landing-accent-hover shadow-landing-accent inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-base font-semibold text-white transition"
            >
              Create your store
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/80 px-6 py-3.5 text-base font-semibold text-slate-800 backdrop-blur transition hover:bg-white"
            >
              See features
            </a>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-700">
            <span className="inline-flex items-center gap-1.5">
              <Check className="text-landing-accent h-4 w-4" /> Free to start
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="text-landing-accent h-4 w-4" /> COD, bKash &amp; Nagad
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-emerald-200/60 to-emerald-400/30 blur-2xl" />
          <img
            src={heroAsset.url}
            alt="EazyStore mobile storefront and dashboard preview"
            width={1280}
            height={1024}
            className="w-full rounded-[1.75rem] shadow-2xl ring-1 ring-emerald-900/5"
          />
        </div>
      </section>
    </div>
  );
}

/* ---------------- Features ---------------- */

const FEATURES = [
  {
    icon: Store,
    title: "Your own storefront",
    desc: "Every store gets a shareable link and a polished, responsive shop your customers will love.",
  },
  {
    icon: Package,
    title: "Product management",
    desc: "Add products with images, prices, stock and descriptions in seconds.",
  },
  {
    icon: BarChart3,
    title: "Sales analytics",
    desc: "Track revenue and orders with clean, real-time charts on your dashboard.",
  },
  {
    icon: Truck,
    title: "Order tracking",
    desc: "Move orders through Pending, Shipped and Delivered with a single tap.",
  },
  {
    icon: Palette,
    title: "3 store themes",
    desc: "Switch between Aurora, Midnight and Sunset themes to match your brand.",
  },
  {
    icon: CreditCard,
    title: "Local payments",
    desc: "Accept Cash on Delivery plus manual bKash & Nagad — built for Bangladesh.",
  },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-hero text-3xl leading-tight tracking-tight text-slate-900 sm:text-5xl">
          Everything you need to sell online
        </h2>
        <p className="mt-4 text-slate-600">
          From your first product to your thousandth order, EazyStore has the tools to grow.
        </p>
      </div>

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-emerald-100 bg-white p-7 shadow-[0_1px_2px_rgba(16,185,129,0.06)] transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="bg-landing-accent-soft text-landing-accent grid h-11 w-11 place-items-center rounded-xl">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-6 font-hero text-lg text-slate-900">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- How it works ---------------- */

const STEPS = [
  { n: "01", title: "Create your store", desc: "Sign up as a merchant and claim your unique store link." },
  { n: "02", title: "Add your products", desc: "Upload photos, set prices and stock for your catalog." },
  { n: "03", title: "Start selling", desc: "Share your storefront and manage orders as they roll in." },
];

function HowItWorks() {
  return (
    <section id="how" className="bg-emerald-50/70 py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-hero text-3xl leading-tight tracking-tight text-slate-900 sm:text-5xl">
            Launch in three simple steps
          </h2>
          <p className="mt-3 text-slate-600">No technical skills required.</p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl bg-white p-8 shadow-[0_1px_2px_rgba(16,185,129,0.08)]">
              <div className="font-hero text-landing-accent text-3xl">{s.n}</div>
              <h3 className="mt-4 font-hero text-lg text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Pricing ---------------- */

const PLANS = [
  {
    name: "Starter",
    price: "Free",
    priceSuffix: "forever",
    desc: "Everything you need to launch your first store.",
    features: ["1 storefront", "Up to 25 products", "Order management", "COD payments"],
    cta: "Start free",
    ctaTo: "/auth",
    featured: false,
  },
  {
    name: "Growth",
    price: "৳990",
    priceSuffix: "/month",
    desc: "For growing brands that need more power.",
    features: [
      "Unlimited products",
      "Sales analytics",
      "All 3 store themes",
      "bKash & Nagad payments",
      "Priority support",
    ],
    cta: "Start 14-day trial",
    ctaTo: "/auth",
    featured: true,
  },
  {
    name: "Scale",
    price: "৳2,490",
    priceSuffix: "/month",
    desc: "Advanced tools for high-volume sellers.",
    features: ["Everything in Growth", "Custom domain", "Multiple staff seats", "Advanced reports"],
    cta: "Talk to sales",
    ctaTo: "/auth",
    featured: false,
  },
];

function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-hero text-3xl leading-tight tracking-tight text-slate-900 sm:text-5xl">
          Simple, transparent pricing
        </h2>
        <p className="mt-3 text-slate-600">Start free. Upgrade when you grow.</p>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={
              p.featured
                ? "border-landing-accent relative rounded-2xl border-2 bg-white p-8 shadow-lg"
                : "rounded-2xl border border-emerald-100 bg-white p-8 shadow-sm"
            }
          >
            {p.featured && (
              <span className="bg-landing-accent absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold text-white shadow">
                Most popular
              </span>
            )}
            <h3 className="font-hero text-lg text-slate-900">{p.name}</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="font-hero text-4xl text-slate-900">{p.price}</span>
              <span className="text-sm text-slate-500">{p.priceSuffix}</span>
            </div>
            <p className="mt-3 text-sm text-slate-600">{p.desc}</p>

            <ul className="mt-6 space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                  <Check className="text-landing-accent mt-0.5 h-4 w-4 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Link
              to={p.ctaTo}
              className={
                p.featured
                  ? "bg-landing-accent hover:bg-landing-accent-hover mt-7 block rounded-full py-3 text-center text-sm font-semibold text-white transition"
                  : "mt-7 block rounded-full border border-slate-300 py-3 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              }
            >
              {p.cta}
            </Link>
          </div>
        ))}
      </div>

      {/* Role shortcuts */}
      <div className="mt-16 grid gap-4 sm:grid-cols-2">
        <Link
          to="/auth"
          className="group flex items-center gap-4 rounded-2xl border border-emerald-100 bg-white p-5 transition hover:border-emerald-300"
        >
          <div className="bg-landing-accent-soft text-landing-accent grid h-11 w-11 place-items-center rounded-xl">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">For founders</p>
            <p className="font-hero text-slate-900">I'm a Store Owner</p>
          </div>
          <ArrowRight className="text-landing-accent h-5 w-5 transition group-hover:translate-x-1" />
        </Link>
        <Link
          to="/admin"
          className="group flex items-center gap-4 rounded-2xl border border-emerald-100 bg-white p-5 transition hover:border-emerald-300"
        >
          <div className="bg-landing-accent-soft text-landing-accent grid h-11 w-11 place-items-center rounded-xl">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">For platform team</p>
            <p className="font-hero text-slate-900">I'm a Super Admin</p>
          </div>
          <ArrowRight className="text-landing-accent h-5 w-5 transition group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  );
}

/* ---------------- CTA banner ---------------- */

function CtaBanner() {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 px-8 py-16 text-center text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.25),transparent_60%)]" />
        <div className="relative">
          <ShoppingCart className="mx-auto h-10 w-10" />
          <h2 className="font-hero mt-6 text-3xl leading-tight tracking-tight sm:text-5xl">
            Ready to open your store?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-emerald-50">
            Join merchants selling smarter with EazyStore. Set up your store today — it's free.
          </p>
          <Link
            to="/auth"
            className="group mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-base font-semibold text-emerald-700 shadow-md transition hover:bg-emerald-50"
          >
            Create your store
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Footer (Zatiq-style) ---------------- */

function Footer() {
  return (
    <footer className="bg-gradient-to-b from-emerald-50 via-white to-emerald-50/60 px-4 pb-10 pt-16 sm:px-8">
      {/* Tagline */}
      <p className="mx-auto max-w-4xl text-center font-hero text-2xl leading-snug tracking-tight text-slate-900 sm:text-4xl">
        Easily take your business online with{" "}
        <span className="font-hero italic text-landing-accent">EazyStore</span> in just one click.
      </p>

      {/* Main card */}
      <div className="mx-auto mt-10 max-w-6xl rounded-3xl bg-white p-6 shadow-[0_10px_40px_-15px_rgba(16,185,129,0.25)] ring-1 ring-emerald-100 sm:p-10">
        <div className="grid gap-10 md:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2">
              <div className="gradient-landing-brand grid h-9 w-9 place-items-center rounded-xl text-white shadow-md">
                <Store className="h-5 w-5" />
              </div>
              <span className="font-hero text-lg text-slate-900">
                eazy<span className="text-landing-accent">store</span>
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              Launch and manage your online store with a beautiful storefront, powerful dashboard
              and local payments — built for modern merchants.
            </p>
          </div>

          {/* General */}
          <FooterCol title="General">
            <FooterLink to="/">Home</FooterLink>
            <FooterAnchor href="#pricing">Pricing</FooterAnchor>
            <FooterAnchor href="#features">About Us</FooterAnchor>
          </FooterCol>

          {/* Company */}
          <FooterCol title="Company">
            <FooterAnchor href="#contact">Contact Us</FooterAnchor>
            <FooterAnchor href="#terms">Terms &amp; Conditions</FooterAnchor>
            <FooterAnchor href="#privacy">Privacy Policy</FooterAnchor>
            <FooterAnchor href="#refund">Return and Refund Policy</FooterAnchor>
          </FooterCol>

          {/* Partner Program */}
          <FooterCol title="Partner Program">
            <p className="text-sm text-slate-600">Earn up to 15% recurring commission</p>
            <a
              href="#partner"
              className="text-landing-accent hover:text-landing-accent-hover mt-2 inline-flex items-center gap-1.5 text-sm font-semibold"
            >
              Become A Partner
              <ArrowRight className="h-4 w-4" />
            </a>
          </FooterCol>
        </div>

        {/* Address / Follow us */}
        <div className="mt-10 grid gap-8 rounded-2xl bg-emerald-50/70 p-6 sm:p-8 md:grid-cols-2">
          <div>
            <h4 className="font-hero text-base text-slate-900">Address</h4>
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              <li className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-landing-accent shadow-sm">
                  <Phone className="h-4 w-4" />
                </span>
                +880 1969 909069
              </li>
              <li className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-landing-accent shadow-sm">
                  <Mail className="h-4 w-4" />
                </span>
                info@eazystore.xyz
              </li>
              <li className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-landing-accent shadow-sm">
                  <MapPin className="h-4 w-4" />
                </span>
                Dhaka, Bangladesh
              </li>
            </ul>
          </div>

          <div className="md:text-right">
            <h4 className="font-hero text-base text-slate-900">Follow Us</h4>
            <div className="mt-4 flex gap-3 md:justify-end">
              <SocialIcon href="#" label="Facebook"><Facebook className="h-4 w-4" /></SocialIcon>
              <SocialIcon href="#" label="YouTube"><Youtube className="h-4 w-4" /></SocialIcon>
              <SocialIcon href="#" label="Instagram"><Instagram className="h-4 w-4" /></SocialIcon>
              <SocialIcon href="#" label="LinkedIn"><Linkedin className="h-4 w-4" /></SocialIcon>
            </div>
          </div>
        </div>

        {/* Divider + copyright */}
        <div className="mt-8 border-t border-emerald-100 pt-6 text-center text-sm text-slate-500">
          Copyright © 2022–{new Date().getFullYear()} EazyStore. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-hero text-base text-slate-900">{title}</h4>
      <ul className="mt-4 space-y-3 text-sm text-slate-600">{children}</ul>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className="hover:text-landing-accent transition">
        {children}
      </Link>
    </li>
  );
}

function FooterAnchor({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <a href={href} className="hover:text-landing-accent transition">
        {children}
      </a>
    </li>
  );
}

function SocialIcon({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className="text-landing-accent hover:bg-landing-accent grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm ring-1 ring-emerald-100 transition hover:text-white"
    >
      {children}
    </a>
  );
}
