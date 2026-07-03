import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Mail, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { sendPhoneOtp, verifyPhoneOtp } from "@/lib/phone-otp.functions";
import eazystoreLogo from "@/assets/eazystore-logo.png.asset.json";


const searchSchema = z.object({ redirect: z.string().optional() });

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(80, "Full name is too long"),
  email: z.string().trim().email("Please enter a valid email").max(255),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password is too long")
    .regex(/[A-Za-z]/, "Password must include a letter")
    .regex(/[0-9]/, "Password must include a number"),
});

const signinSchema = z.object({
  email: z.string().trim().email("Please enter a valid email").max(255),
  password: z.string().min(1, "Password is required").max(72),
});

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{8,20}$/, "Enter a valid phone number in international format (e.g. +8801XXXXXXXXX)")
  .transform((v) => {
    const digits = v.replace(/[\s-]/g, "");
    return digits.startsWith("+") ? digits : `+${digits.replace(/^0+/, "")}`;
  });
const otpSchema = z.string().trim().regex(/^[0-9]{6}$/, "Enter the 6-digit code we sent");

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Create Your Account — EazyStore" },
      { name: "description", content: "Start selling for free — no credit card required. Create your EazyStore account." },
      { property: "og:title", content: "Create Your Account — EazyStore" },
      { property: "og:description", content: "Start selling for free — no credit card required. Create your EazyStore account." },
      { property: "og:url", content: "https://eazystorebd.lovable.app/auth" },
    ],
    links: [{ rel: "canonical", href: "https://eazystorebd.lovable.app/auth" }],
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
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendBusy, setResendBusy] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);


  const safeRedirect = redirect && redirect.startsWith("/") ? redirect : null;

  async function routeAfterAuth() {
    if (safeRedirect) {
      navigate({ to: safeRedirect as "/" });
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .eq("owner_user_id", userData.user.id)
      .maybeSingle();
    navigate({ to: store ? "/dashboard" : "/onboarding" });
  }

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted && data.user) routeAfterAuth();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") routeAfterAuth();
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function friendlyError(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes("invalid login")) return "Wrong email or password.";
    if (m.includes("already registered") || m.includes("already been registered") || m.includes("user already"))
      return "This email is already registered. Try logging in instead.";
    if (m.includes("email not confirmed")) return "Please confirm your email from the link we sent before signing in.";
    if (m.includes("rate limit")) return "Too many attempts. Please wait a moment and try again.";
    return msg;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const parsed = signupSchema.safeParse({ fullName, email, password });
        if (!parsed.success) {
          setError(parsed.error.errors[0]?.message ?? "Invalid input");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: parsed.data.fullName, name: parsed.data.fullName },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setPendingEmail(parsed.data.email);
          setResendCooldown(60);
          setInfo(null);
          setPassword("");
          return;
        }
        await routeAfterAuth();

      } else {
        const parsed = signinSchema.safeParse({ email, password });
        if (!parsed.success) {
          setError(parsed.error.errors[0]?.message ?? "Invalid input");
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        await routeAfterAuth();
      }
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Something went wrong"));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setInfo(null);
    setOauthBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError(friendlyError(result.error.message ?? "Google sign-in failed"));
        return;
      }
      if (result.redirected) return; // browser navigating away
      const { data: userData } = await supabase.auth.getUser();
      let dest = safeRedirect ?? "/";
      if (!safeRedirect && userData.user) {
        const { data: store } = await supabase
          .from("stores")
          .select("id")
          .eq("owner_user_id", userData.user.id)
          .maybeSingle();
        dest = store ? "/dashboard" : "/onboarding";
      }
      window.location.assign(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setOauthBusy(false);
    }
  }

  async function handleForgotPassword() {
    setError(null);
    setInfo(null);
    const parsed = z.string().trim().email().safeParse(email);
    if (!parsed.success) {
      setError("Enter your email above first, then tap 'Forgot password'.");
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      setInfo("Password reset link sent. Check your email.");
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Could not send reset email"));
    }
  }

  async function handleResendVerification() {
    if (!pendingEmail || resendCooldown > 0 || resendBusy) return;
    setError(null);
    setInfo(null);
    setResendBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingEmail,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setInfo(`Verification email resent to ${pendingEmail}.`);
      setResendCooldown(60);
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Could not resend email"));
    } finally {
      setResendBusy(false);
    }
  }

  async function handleCheckVerified() {
    if (!pendingEmail) return;
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (data.user?.email_confirmed_at) {
        await routeAfterAuth();
      } else {
        setInfo("Not verified yet. Please click the link in your email, then try again.");
      }
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Could not check status"));
    } finally {
      setBusy(false);
    }
  }

  function handleUsedDifferentEmail() {
    setPendingEmail(null);
    setMode("signin");
    setInfo(null);
    setError(null);
  }

  const isSignup = mode === "signup";




  const sendOtpFn = useServerFn(sendPhoneOtp);
  const verifyOtpFn = useServerFn(verifyPhoneOtp);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Invalid phone number");
      return;
    }
    if (isSignup && fullName.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    setBusy(true);
    try {
      await sendOtpFn({
        data: { phone: parsed.data, fullName: isSignup ? fullName.trim() : undefined, isSignup },
      });
      setPhone(parsed.data);
      setOtpSent(true);
      setOtp("");
      setInfo(`We sent a verification code to ${parsed.data}.`);
    } catch (err) {
      setError(friendlyPhoneError(err instanceof Error ? err.message : "Could not send code"));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const parsed = otpSchema.safeParse(otp);
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Invalid code");
      return;
    }
    setBusy(true);
    try {
      const result = await verifyOtpFn({
        data: {
          phone,
          code: parsed.data,
          fullName: isSignup ? fullName.trim() : undefined,
          isSignup,
        },
      });
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        phone: result.phone,
        password: result.password,
      });
      if (signInErr) throw signInErr;
      await routeAfterAuth();
    } catch (err) {
      setError(friendlyPhoneError(err instanceof Error ? err.message : "Could not verify code"));
    } finally {
      setBusy(false);
    }
  }

  function friendlyPhoneError(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes("sms provider is not configured"))
      return "Phone sign-in is not fully set up yet. Please use Email or Google for now.";
    if (m.includes("already registered")) return "This phone number is already registered. Try signing in instead.";
    if (m.includes("no account found")) return "No account found for this number. Switch to Sign Up to create one.";
    if (m.includes("incorrect code")) return "Wrong code. Please check and try again.";
    if (m.includes("expired")) return "This code has expired. Please request a new one.";
    if (m.includes("too many")) return msg;
    return friendlyError(msg);
  }




  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f5eefe_0%,#e4d6fb_55%,#f1e8fe_100%)] px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-md">
        <Link to="/" className="mb-6 inline-flex items-center gap-2">
          <img src={eazystoreLogo.url} alt="EazyStore" className="h-9 w-9 shrink-0 rounded-xl object-contain" />
          <span className="font-display text-xl font-bold tracking-tight text-slate-900">
            eazy<span className="text-purple-700">store</span>
          </span>
        </Link>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          {pendingEmail ? (
            <div className="space-y-5">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-purple-100 text-purple-700">
                <Mail className="h-7 w-7" />
              </div>
              <div className="text-center">
                <h1 className="font-display text-2xl font-black leading-tight text-slate-900 sm:text-3xl">
                  Verify your email
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  We sent a confirmation link to{" "}
                  <span className="font-semibold text-slate-900">{pendingEmail}</span>. Open it on this device to finish
                  creating your account.
                </p>
              </div>

              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>
              )}
              {info && (
                <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{info}</p>
              )}

              <button
                type="button"
                onClick={handleCheckVerified}
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-700/30 transition hover:bg-purple-800 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                I've verified — continue
              </button>

              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendBusy || resendCooldown > 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                {resendBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                {resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : "Resend verification email"}
              </button>

              <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-700">Didn't get it?</p>
                <ul className="list-disc space-y-1 pl-4">
                  <li>Check your spam or promotions folder.</li>
                  <li>Make sure the address above is spelled correctly.</li>
                  <li>Some providers can take 1–2 minutes to deliver.</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={handleUsedDifferentEmail}
                className="block w-full text-center text-xs font-semibold text-purple-700 hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
          <>
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


          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={oauthBusy || busy}
            className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            {oauthBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.12A6.97 6.97 0 0 1 5.47 12c0-.74.13-1.45.36-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.96l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
              </svg>
            )}
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Phone signup temporarily unavailable — Email + Google only */}


          {method === "email" ? (
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
                    minLength={isSignup ? 8 : 1}
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isSignup ? "At least 8 characters, with a number" : "Your password"}
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
                {!isSignup && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="mt-2 text-xs font-semibold text-purple-700 hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </Field>

              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>
              )}
              {info && (
                <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{info}</p>
              )}

              <button
                type="submit"
                disabled={busy || oauthBusy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-700/30 transition hover:bg-purple-800 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSignup ? "Get Started" : "Sign In"}
              </button>
            </form>
          ) : (
            <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="mt-6 space-y-5">
              {isSignup && !otpSent && (
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

              <Field label="Phone Number">
                <input
                  type="tel"
                  required
                  autoComplete="tel"
                  inputMode="tel"
                  value={phone}
                  disabled={otpSent}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+8801XXXXXXXXX"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200 disabled:bg-slate-100 disabled:text-slate-500"
                />
                <p className="mt-1.5 text-xs text-slate-500">Include country code, e.g. +880 for Bangladesh.</p>
              </Field>

              {otpSent && (
                <Field label="Verification Code">
                  <input
                    type="text"
                    required
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={8}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="6-digit code"
                    className="w-full rounded-xl border border-slate-200 bg-purple-50/60 px-4 py-3 text-center text-lg font-semibold tracking-[0.4em] text-slate-900 placeholder:text-slate-400 placeholder:tracking-normal placeholder:text-sm placeholder:font-normal outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                  />
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => { setOtpSent(false); setOtp(""); setError(null); setInfo(null); }}
                      className="font-semibold text-slate-600 hover:underline"
                    >
                      Change number
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => { setOtp(""); handleSendOtp(new Event("submit") as unknown as React.FormEvent); }}
                      className="font-semibold text-purple-700 hover:underline disabled:opacity-50"
                    >
                      Resend code
                    </button>
                  </div>
                </Field>
              )}

              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>
              )}
              {info && (
                <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{info}</p>
              )}

              <button
                type="submit"
                disabled={busy || oauthBusy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-700/30 transition hover:bg-purple-800 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {otpSent ? "Verify & Continue" : isSignup ? "Send Verification Code" : "Send Login Code"}
              </button>
            </form>
          )}

          <p className="mt-5 text-center text-sm text-slate-600">
            {isSignup ? "Already have an account? " : "New here? "}
            {isSignup ? (
              <Link to="/login" className="font-semibold text-purple-700 hover:underline">
                Login
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(null); setInfo(null); }}
                className="font-semibold text-purple-700 hover:underline"
              >
                Create an account
              </button>
            )}
          </p>

          <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">
            By signing up you agree to the{" "}
            <a href="#" className="font-semibold text-purple-700 hover:underline">Terms of Use</a>
            {" "}&amp;{" "}
            <a href="#" className="font-semibold text-purple-700 hover:underline">Privacy Policy</a>
            {" "}of EazyStore.
          </p>
          </>
          )}
        </div>

      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-slate-900">{label}</span>
      {children}
    </label>
  );
}
