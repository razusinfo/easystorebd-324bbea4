import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, Shirt, Cpu, Dumbbell, Sparkles, Loader2, Mail,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  useMyStore, useCreateStore, TEMPLATES, type Category, type TemplateId,
} from "@/lib/eazystore-data";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Onboarding — EazyStore" }] }),
  component: Onboarding,
});

const STEPS = ["Account", "Store name", "Category", "Template"] as const;

function Onboarding() {
  const navigate = useNavigate();
  const myStore = useMyStore();
  const createStore = useCreateStore();
  const [step, setStep] = useState(0);
  const [storeName, setStoreName] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [template, setTemplate] = useState<TemplateId | null>(null);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  // If a store already exists for this user, go to dashboard.
  useEffect(() => {
    if (myStore.data) navigate({ to: "/dashboard" });
  }, [myStore.data, navigate]);

  const canNext =
    (step === 0) ||
    (step === 1 && storeName.trim().length >= 2) ||
    (step === 2 && !!category) ||
    (step === 3 && !!template);

  async function finish() {
    if (!category || !template || !storeName.trim()) return;
    try {
      await createStore.mutateAsync({ name: storeName.trim(), category, template });
      navigate({ to: "/dashboard" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not create store");
    }
  }

  if (myStore.isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
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

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Step {step + 1} of {STEPS.length}</span>
            <span>{STEPS[step]}</span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition ${i <= step ? "gradient-primary" : "bg-muted"}`} />
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-md sm:p-7">
          {step === 0 && (
            <div className="animate-fade-up">
              <h1 className="font-display text-2xl font-bold">You're signed in</h1>
              <p className="mt-1 text-sm text-muted-foreground">Continue setting up your store.</p>

              <div className="mt-5 flex items-center gap-3 rounded-2xl border-2 border-primary bg-primary/5 p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-primary text-white">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account</div>
                  <div className="truncate text-sm font-semibold">{email || "—"}</div>
                </div>
                <Check className="ml-auto h-5 w-5 shrink-0 text-primary" />
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
              <p className="mt-1 text-sm text-muted-foreground">You can change this later.</p>
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
                    <div className="grid h-11 w-11 place-items-center rounded-xl gradient-primary text-white">{c.icon}</div>
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
              <p className="mt-1 text-sm text-muted-foreground">Pick a look — change anytime.</p>
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
          disabled={!canNext || createStore.isPending}
          onClick={() => (step === STEPS.length - 1 ? finish() : setStep((s) => s + 1))}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl gradient-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-md transition hover:shadow-glow disabled:opacity-40 disabled:shadow-none"
        >
          {createStore.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {step === STEPS.length - 1 ? "Create my store" : "Continue"}
          {!createStore.isPending && <ArrowRight className="h-4 w-4" />}
        </button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Not you? <Link to="/" className="font-semibold text-primary hover:underline">Back to home</Link>
        </p>
      </div>
    </main>
  );
}
