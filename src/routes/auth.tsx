import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Sparkles, Mail, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — EazyStore" },
      { name: "description", content: "Sign in or sign up to manage your EazyStore." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // If already signed in, bounce out.
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted && data.user) {
        navigate({ to: redirect && redirect.startsWith("/") ? (redirect as "/") : "/onboarding" });
      }
    });
    return () => { mounted = false; };
  }, [navigate, redirect]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
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

  async function handleGoogle() {
    setError(null);
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError(result.error.message ?? "Google sign-in failed");
        setBusy(false);
        return;
      }
      if (result.redirected) return; // browser will navigate away
      navigate({ to: redirect && redirect.startsWith("/") ? (redirect as "/") : "/onboarding" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 -z-10 gradient-hero opacity-90" />
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-white/80 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Home
        </Link>

        <div className="mt-6 flex items-center gap-2 text-white">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 backdrop-blur">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">EazyStore</span>
        </div>

        <h1 className="mt-6 font-display text-3xl font-black text-white">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-white/80">
          {mode === "signin" ? "Sign in to manage your store." : "Sign up to launch your store in minutes."}
        </p>

        <div className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-lg sm:p-6">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-border px-4 py-3 text-sm font-semibold transition hover:border-primary/50 disabled:opacity-50"
          >
            <GoogleIcon className="h-5 w-5" />
            Continue with Google
          </button>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</label>
              <div className="mt-1.5 flex items-stretch overflow-hidden rounded-2xl border-2 border-border focus-within:border-primary">
                <span className="grid place-items-center bg-muted px-3 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="mt-1.5 w-full rounded-2xl border-2 border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl gradient-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-md transition hover:shadow-glow disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
              className="font-semibold text-primary hover:underline"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
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
