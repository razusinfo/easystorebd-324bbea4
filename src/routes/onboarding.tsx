import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Phone, Shirt, Cpu, Dumbbell, Sparkles } from "lucide-react";
import { db, TEMPLATES, type Category, type TemplateId } from "@/lib/eazystore-store";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding — EazyStore" },
      { name: "description", content: "Set up your store in 4 quick steps." },
    ],
  }),
  component: Onboarding,
});

const STEPS = ["Sign in", "Store name", "Category", "Template"] as const;

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [login, setLogin] = useState<{ method: "google" | "phone"; value: string } | null>(null);
  const [phone, setPhone] = useState("");
  const [storeName, setStoreName] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [template, setTemplate] = useState<TemplateId | null>(null);

  const canNext =
    (step === 0 && !!login) ||
    (step === 1 && storeName.trim().length >= 2) ||
    (step === 2 && !!category) ||
    (step === 3 && !!template);

  function finish() {
    if (!login || !category || !template || !storeName.trim()) return;
    const id = `s_${Date.now().toString(36)}`;
    db.addStore({
      id,
      ownerName: login.method === "google" ? login.value.split("@")[0] : "Store Owner",
      ownerContact: login.value,
      loginMethod: login.method,
      name: storeName.trim(),
      category,
      template,
      createdAt: Date.now(),
    });
    db.setActiveStoreId(id);
    navigate({ to: "/dashboard" });
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-xl px-5 py-6 sm:py-10">
        <button
          onClick={() => (step === 0 ? navigate({ to: "/" }) : setStep((s) => s - 1))}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Progress */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Step {step + 1} of {STEPS.length}</span>
            <span>{STEPS[step]}</span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition ${i <= step ? "gradient-primary" : "bg-muted"}`}
              />
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-md sm:p-7">
          {step === 0 && (
            <div className="animate-fade-up">
              <h1 className="font-display text-2xl font-bold">Sign in to continue</h1>
              <p className="mt-1 text-sm text-muted-foreground">Pick the easiest way for you.</p>

              <button
                onClick={() => setLogin({ method: "google", value: "owner@gmail.com" })}
                className={`mt-5 flex w-full items-center justify-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-sm font-semibold transition ${
                  login?.method === "google"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <GoogleIcon className="h-5 w-5" />
                Continue with Google
                {login?.method === "google" && <Check className="ml-auto h-4 w-4 text-primary" />}
              </button>

              <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
              </div>

              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Phone number
              </label>
              <div className="mt-1.5 flex items-stretch overflow-hidden rounded-2xl border-2 border-border focus-within:border-primary">
                <span className="grid place-items-center bg-muted px-3 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                </span>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="+8801XXXXXXXXX"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (e.target.value.trim().length >= 7) setLogin({ method: "phone", value: e.target.value.trim() });
                    else if (login?.method === "phone") setLogin(null);
                  }}
                  className="flex-1 bg-transparent px-3 py-3 text-sm outline-none"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="animate-fade-up">
              <h1 className="font-display text-2xl font-bold">Name your store</h1>
              <p className="mt-1 text-sm text-muted-foreground">This is how customers will see you.</p>
              <input
                autoFocus
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="e.g. Trendline Boutique"
                className="mt-5 w-full rounded-2xl border-2 border-border bg-background px-4 py-3.5 text-base font-medium outline-none focus:border-primary"
              />
              <p className="mt-2 text-xs text-muted-foreground">Min 2 characters.</p>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-up">
              <h1 className="font-display text-2xl font-bold">Pick a category</h1>
              <p className="mt-1 text-sm text-muted-foreground">You can add more product types later.</p>
              <div className="mt-5 grid gap-3">
                {([
                  { id: "Clothes", icon: <Shirt className="h-5 w-5" />, desc: "Apparel, fashion, accessories" },
                  { id: "Electronics", icon: <Cpu className="h-5 w-5" />, desc: "Gadgets, mobiles, audio" },
                  { id: "Sports", icon: <Dumbbell className="h-5 w-5" />, desc: "Fitness, outdoor, gear" },
                ] as const).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${
                      category === c.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="grid h-11 w-11 place-items-center rounded-xl gradient-primary text-white">
                      {c.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{c.id}</div>
                      <div className="text-xs text-muted-foreground">{c.desc}</div>
                    </div>
                    {category === c.id && <Check className="h-5 w-5 text-primary" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-up">
              <h1 className="font-display text-2xl font-bold">Choose a template</h1>
              <p className="mt-1 text-sm text-muted-foreground">Pick a look — you can change it anytime.</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTemplate(t.id)}
                    className={`group overflow-hidden rounded-2xl border-2 text-left transition ${
                      template === t.id ? "border-primary shadow-glow" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className={`relative h-24 bg-gradient-to-br ${t.gradient}`}>
                      <Sparkles className="absolute right-2 top-2 h-4 w-4 text-white/80" />
                      {template === t.id && (
                        <div className="absolute inset-0 grid place-items-center bg-black/30">
                          <div className="grid h-8 w-8 place-items-center rounded-full bg-white text-primary">
                            <Check className="h-4 w-4" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{t.tagline}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          disabled={!canNext}
          onClick={() => (step === STEPS.length - 1 ? finish() : setStep((s) => s + 1))}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl gradient-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-md transition hover:shadow-glow disabled:opacity-40 disabled:shadow-none"
        >
          {step === STEPS.length - 1 ? "Create my store" : "Continue"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </main>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.12A6.99 6.99 0 0 1 5.46 12c0-.74.13-1.45.36-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.96l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
