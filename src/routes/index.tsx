import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Lock, ArrowRight, Sparkles, Phone, ShieldCheck, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { defaultSession, setSession, getSession } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bongo Inventory — Login" },
      { name: "description", content: "Sign in to Bongo Inventory — premium SaaS POS & inventory for Bangladesh businesses." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState("demo@bongoinventory.bd");
  const [password, setPassword] = useState("••••••••");

  useEffect(() => {
    if (getSession()) navigate({ to: "/dashboard" });
  }, [navigate]);

  const handleLogin = (e?: React.FormEvent) => {
    e?.preventDefault();
    setSession({ ...defaultSession, email });
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* LEFT — brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 gradient-hero text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)",
          backgroundSize: "60px 60px, 90px 90px",
        }} />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/40 blur-3xl animate-float" />
        <div className="absolute -top-20 -left-10 h-72 w-72 rounded-full bg-primary/40 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/15 backdrop-blur-xl border border-white/20">
              <span className="text-2xl font-black">ব</span>
            </div>
            <div>
              <div className="font-display text-xl font-black">Bongo Inventory</div>
              <div className="text-xs text-white/70">by Software Point</div>
            </div>
          </div>
        </div>

        <div className="relative space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur text-xs font-semibold">
              <Sparkles className="h-3 w-3" />
              বাংলাদেশের #১ ইনভেন্টরি সফটওয়্যার
            </div>
            <h1 className="mt-4 font-display text-5xl font-black leading-tight">
              আপনার ব্যবসা <br /> এক ছাদের নিচে।
            </h1>
            <p className="mt-3 text-white/80 max-w-md">
              ইলেকট্রনিক্স, মোবাইল, ফ্যাশন, গ্রোসারি, সুপার শপ, ফার্মেসি, হার্ডওয়্যার ও সিসিটিভি ব্যবসার জন্য সম্পূর্ণ POS, ইনভেন্টরি, কিস্তি, ওয়ারেন্টি ও হিসাব ম্যানেজমেন্ট।
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Zap, label: "Lightning POS", bn: "দ্রুত POS" },
              { icon: ShieldCheck, label: "Secure Cloud", bn: "নিরাপদ ক্লাউড" },
              { icon: Sparkles, label: "AI Insights", bn: "এআই ইনসাইট" },
            ].map((f) => (
              <div key={f.label} className="rounded-xl bg-white/10 border border-white/15 backdrop-blur p-3">
                <f.icon className="h-5 w-5 mb-2" />
                <div className="text-xs font-semibold">{f.bn}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-white/60 flex items-center gap-2">
          <Phone className="h-3.5 w-3.5" />
          <a href="https://www.softwarepointbd.com/" target="_blank" rel="noreferrer" className="hover:text-white">softwarepointbd.com</a>
          <span>•</span>
          <a href="tel:01724561670" className="hover:text-white">Hotline 01724-561670</a>
        </div>
      </div>

      {/* RIGHT — form */}
      <div className="flex flex-col p-6 sm:p-12">
        <div className="flex justify-end gap-2 mb-8">
          <button
            type="button"
            onClick={() => setLang(lang === "bn" ? "en" : "bn")}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted"
          >
            {lang === "bn" ? "English" : "বাংলা"}
          </button>
          <button
            type="button"
            onClick={toggle}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>

        <div className="m-auto w-full max-w-sm space-y-7 animate-fade-up">
          <div className="lg:hidden flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl gradient-primary shadow-glow">
              <span className="text-2xl font-black text-primary-foreground">ব</span>
            </div>
            <div>
              <div className="font-display text-xl font-black">Bongo Inventory</div>
              <div className="text-xs text-muted-foreground">by Software Point</div>
            </div>
          </div>

          <div>
            <h2 className="font-display text-3xl font-black">{t("welcomeBack")}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t("signInToContinue")}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("email")}</label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 pl-10 pr-3 rounded-xl bg-muted/40 border border-border focus:border-ring focus:bg-card outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("password")}</label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 pl-10 pr-3 rounded-xl bg-muted/40 border border-border focus:border-ring focus:bg-card outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-bold shadow-md hover:shadow-glow transition flex items-center justify-center gap-2"
            >
              {t("signIn")}
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => handleLogin()}
              className="w-full h-11 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 text-sm font-semibold transition flex items-center justify-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {t("demoLogin")}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            {t("madeBy")}{" "}
            <Link to="/" className="font-semibold text-foreground hover:text-primary">Software Point</Link>
            {" "}•{" "}
            <a href="tel:01724561670" className="hover:text-primary">01724-561670</a>
          </p>
        </div>
      </div>
    </div>
  );
}
