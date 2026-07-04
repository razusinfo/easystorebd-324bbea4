import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, Sparkles, Loader2, Mail, Languages, Briefcase,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type Lang } from "@/lib/i18n";
import {
  useMyStore, useCreateStore, TEMPLATES, BUSINESS_TYPES, type Category, type TemplateId,
} from "@/lib/eazystore-data";
import {
  MinimalMonoPreview, BoutiqueBlushPreview, TechGridPreview, SportyPulsePreview, LuxeNoirPreview,
} from "@/components/templates/mini-previews";
import { EazyStoreBasicTemplate } from "@/components/templates/eazystore-basic-template";
import { AutoPartsTemplate } from "@/components/templates/autoparts-template";
import { PrestigeTemplate } from "@/components/templates/prestige-template";
import eazystoreBasicPreview from "@/assets/eazystore-basic-preview.png.asset.json";


export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Onboarding — EazyStore" }] }),
  component: Onboarding,
});

const STEPS = ["Account", "Store name", "Category", "Template", "Basic info", "Language"] as const;

function Onboarding() {
  const navigate = useNavigate();
  const myStore = useMyStore();
  const createStore = useCreateStore();
  const { lang, setLang } = useI18n();
  const [step, setStep] = useState(0);
  const [storeName, setStoreName] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [template, setTemplate] = useState<TemplateId | null>(null);
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [chosenLang, setChosenLang] = useState<Lang>(lang);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const e = data.user?.email ?? "";
      setEmail(e);
      setContactEmail((prev) => prev || e);
    });
  }, []);

  // If a store already exists for this user, go to dashboard.
  useEffect(() => {
    if (myStore.data) navigate({ to: "/dashboard" });
  }, [myStore.data, navigate]);

  const canNext =
    (step === 0) ||
    (step === 1 && storeName.trim().length >= 2) ||
    (step === 2 && !!category) ||
    (step === 3 && !!template) ||
    (step === 4) ||
    (step === 5);

  async function finish() {
    if (!category || !template || !storeName.trim()) return;
    try {
      setLang(chosenLang);
      await createStore.mutateAsync({
        name: storeName.trim(),
        category,
        template,
        phone,
        address,
        contact_email: contactEmail,
      });
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
          <div className="mt-2 grid grid-cols-6 gap-1.5">
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
              <h1 className="font-display text-2xl font-bold">Business Type</h1>
              <p className="mt-1 text-sm text-muted-foreground">Scroll and pick what best describes your store.</p>
              <div className="mt-5 max-h-[360px] overflow-y-auto rounded-2xl border-2 border-border p-2">
                <div className="grid gap-2">
                  {BUSINESS_TYPES.map((c) => {
                    const active = category === c;
                    return (
                      <button
                        key={c}
                        onClick={() => setCategory(c)}
                        className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition ${
                          active ? "border-primary bg-primary/5" : "border-transparent hover:border-primary/40 hover:bg-muted/50"
                        }`}
                      >
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg gradient-primary text-white">
                          <Briefcase className="h-4 w-4" />
                        </div>
                        <div className="flex-1 font-semibold">{c}</div>
                        {active && <Check className="h-5 w-5 text-primary" />}
                      </button>
                    );
                  })}
                </div>
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
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-white">
                      <TemplatePreview id={t.id} gradient={t.gradient} accent={t.accent} />
                      {t.premium && (
                        <span className="absolute left-2 top-2 rounded-md bg-gradient-to-r from-amber-400 to-orange-500 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow">
                          Premium
                        </span>
                      )}
                      <Sparkles className="absolute right-2 top-2 h-4 w-4 text-white/90 drop-shadow" />
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
                      <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{t.tagline}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-fade-up">
              <h1 className="font-display text-2xl font-bold">Basic info</h1>
              <p className="mt-1 text-sm text-muted-foreground">Optional — you can fill this in later.</p>
              <div className="mt-5 space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+880 1XXX-XXXXXX"
                    className="mt-1 w-full rounded-2xl border-2 border-border bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact email</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="shop@example.com"
                    className="mt-1 w-full rounded-2xl border-2 border-border bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Shop address"
                    rows={2}
                    className="mt-1 w-full rounded-2xl border-2 border-border bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="animate-fade-up">
              <h1 className="font-display text-2xl font-bold">Choose your language</h1>
              <p className="mt-1 text-sm text-muted-foreground">You can change this anytime in settings.</p>
              <div className="mt-5 grid gap-3">
                {([
                  { id: "bn" as Lang, name: "বাংলা", desc: "Bangla — default" },
                  { id: "en" as Lang, name: "English", desc: "English interface" },
                ]).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setChosenLang(l.id)}
                    className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${
                      chosenLang === l.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="grid h-11 w-11 place-items-center rounded-xl gradient-primary text-white">
                      <Languages className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{l.name}</div>
                      <div className="text-xs text-muted-foreground">{l.desc}</div>
                    </div>
                    {chosenLang === l.id && <Check className="h-5 w-5 text-primary" />}
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

function TemplatePreview({ id, gradient, accent }: { id: TemplateId; gradient: string; accent: string }) {
  if (id === "eazystore-basic") {
    return (
      <img
        src={eazystoreBasicPreview.url}
        alt="EazyStore Basic preview"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-top"
      />
    );
  }

  const FULL_W = 1280;
  const FULL_H = 1000;

  let inner: React.ReactNode = null;
  if (id === "autoparts") inner = <AutoPartsTemplate demo accentColor={accent} />;
  else if (id === "prestige") inner = <PrestigeTemplate demo />;
  else if (id === "minimal") inner = <MinimalMonoPreview accent={accent} />;
  else if (id === "boutique") inner = <BoutiqueBlushPreview accent={accent} />;
  else if (id === "techgrid") inner = <TechGridPreview accent={accent} />;
  else if (id === "sporty") inner = <SportyPulsePreview accent={accent} />;
  else if (id === "luxe") inner = <LuxeNoirPreview accent={accent} />;

  if (inner) {
    return (
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden bg-white"
        style={{ containerType: "size" } as React.CSSProperties}
      >
        <div
          style={{
            width: FULL_W,
            height: FULL_H,
            transform: "scale(var(--tpl-scale, 0.2))",
            transformOrigin: "top left",
          }}
        >
          {inner}
        </div>
        <style>{`
          @container (min-width: 180px) { [style*="--tpl-scale"] { --tpl-scale: 0.22; } }
          @container (min-width: 240px) { [style*="--tpl-scale"] { --tpl-scale: 0.28; } }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} style={{ color: accent }} />
  );
}
