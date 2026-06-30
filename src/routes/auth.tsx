import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Create Your Account — EazyStore" },
      { name: "description", content: "Start selling for free — no credit card required. Create your EazyStore account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted && data.user) {
        navigate({ to: redirect && redirect.startsWith("/") ? (redirect as "/") : "/onboarding" });
      }
    });
    return () => { mounted = false; };
  }, [navigate, redirect]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: redirect && redirect.startsWith("/") ? (redirect as "/") : "/onboarding" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f5eefe_0%,#e4d6fb_55%,#f1e8fe_100%)] px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-md">
        <Link to="/" className="mb-6 inline-flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-purple-600 to-violet-600 text-white shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-slate-900">
            eazy<span className="text-purple-700">store</span>
          </span>
        </Link>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          <h1 className="font-display text-3xl font-black leading-tight text-slate-900 sm:text-4xl">
            {isSignup ? "Create Your Account" : "Welcome Back"}
          </h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            {isSignup ? (
              <>Start selling for <span className="font-bold text-purple-700">free</span> — no credit card required</>
            ) : (
              <>Sign in to manage your store</>
            )}
          </p>

          {/* Method tabs */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMethod("email")}
              className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
                method === "email"
                  ? "bg-purple-700 text-white shadow-md ring-2 ring-purple-300"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => setError("Phone sign-up coming soon — please use Email for now.")}
              className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
                method === "phone"
                  ? "bg-purple-700 text-white shadow-md"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Phone No.
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {isSignup && (
              <Field label="Full Name">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                />
              </Field>
            )}

            <Field label="Email Address">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
              />
            </Field>

            <Field label="Password">
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-xl border border-slate-200 bg-purple-50/60 px-4 py-3 pr-11 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                </button>
              </div>
            </Field>

            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-700/30 transition hover:bg-purple-800 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSignup ? "Get Started" : "Sign In"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-600">
            {isSignup ? "Already have an account? " : "New here? "}
            <button
              type="button"
              onClick={() => { setMode(isSignup ? "signin" : "signup"); setError(null); }}
              className="font-semibold text-purple-700 hover:underline"
            >
              {isSignup ? "Login" : "Create an account"}
            </button>
          </p>

          <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">
            By signing up you agree to the{" "}
            <a href="#" className="font-semibold text-purple-700 hover:underline">Terms of Use</a>
            {" "}&amp;{" "}
            <a href="#" className="font-semibold text-purple-700 hover:underline">Privacy Policy</a>
            {" "}of EazyStore.
          </p>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-bold text-slate-900">{label}</label>
      {children}
    </div>
  );
}
