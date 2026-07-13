import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EasyStoreWordmark } from "@/components/eazystore-wordmark";
import { buildOAuthRecoveryUrl, consumeOAuthReturn, sanitizeAuthRedirect } from "@/lib/oauth-flow";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "Signing in — EasyStore" },
      { name: "description", content: "Completing your EasyStore sign-in." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuthCallbackPage,
});

function authErrorFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return search.get("error_description") || search.get("error") || hash.get("error_description") || hash.get("error") || null;
}

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [recoveryUrl, setRecoveryUrl] = useState<string>(buildOAuthRecoveryUrl("/login"));

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const stored = consumeOAuthReturn();
      const mode = stored.mode ?? "signin";
      const fallbackPath = mode === "signup" ? "/auth" : "/login";
      const safeRedirect = sanitizeAuthRedirect(stored.redirect);
      setRecoveryUrl(buildOAuthRecoveryUrl(fallbackPath, safeRedirect, mode));

      const urlError = authErrorFromUrl();
      if (urlError) {
        setError(urlError);
        return;
      }

      for (let attempt = 0; attempt < 12; attempt += 1) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          const { data: userData } = await supabase.auth.getUser();
          if (!userData.user) break;
          if (cancelled) return;
          if (safeRedirect) {
            navigate({ to: safeRedirect as "/" });
            return;
          }
          const { data: store } = await supabase
            .from("stores")
            .select("id")
            .eq("owner_user_id", userData.user.id)
            .maybeSingle();
          navigate({ to: store ? "/dashboard" : "/onboarding" });
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 300));
      }

      if (!cancelled) setError("Google sign-in did not finish on this domain. Please continue from the main site and try again.");
    }

    void finish();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f5eefe_0%,#e4d6fb_55%,#f1e8fe_100%)] px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-md">
        <Link to="/" className="mb-6 inline-flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-purple-600 to-violet-600 text-white shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <EasyStoreWordmark className="text-xl" />
        </Link>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xl sm:p-8">
          {error ? (
            <>
              <h1 className="font-display text-2xl font-black text-slate-900">Google sign-in needs one more step</h1>
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-3 text-sm font-medium text-red-700">{error}</p>
              <a
                href={recoveryUrl}
                className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-purple-700 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-700/30 transition hover:bg-purple-800"
              >
                Continue on main site →
              </a>
              <Link to="/login" className="mt-3 block text-sm font-semibold text-purple-700 hover:underline">
                Back to login
              </Link>
            </>
          ) : (
            <>
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-purple-100 text-purple-700">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
              <h1 className="mt-5 font-display text-2xl font-black text-slate-900">Completing Google sign-in</h1>
              <p className="mt-2 text-sm text-slate-600">Please wait while we finish securely signing you in.</p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
