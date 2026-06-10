import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useSession } from "@/lib/session";
import { roleLabels } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — Bongo Inventory" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const session = useSession();

  return (
    <div>
      <PageHeader title={t("settings")} subtitle={lang === "bn" ? "আপনার অ্যাকাউন্ট ও পছন্দ" : "Your account & preferences"} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl p-6">
          <h3 className="font-display font-bold text-lg mb-4">{lang === "bn" ? "প্রোফাইল" : "Profile"}</h3>
          <div className="flex items-center gap-4 mb-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl gradient-primary text-primary-foreground font-black text-2xl">
              {session?.name?.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-lg truncate">{session?.name}</div>
              <div className="text-sm text-muted-foreground truncate">{session?.email}</div>
              <div className="text-xs text-primary font-semibold mt-0.5">{session && roleLabels[session.role][lang]}</div>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-5">
          <h3 className="font-display font-bold text-lg">{lang === "bn" ? "পছন্দসমূহ" : "Preferences"}</h3>

          <div>
            <div className="text-sm font-semibold mb-2">{lang === "bn" ? "ভাষা" : "Language"}</div>
            <div className="grid grid-cols-2 gap-2">
              {(["bn", "en"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`h-12 rounded-xl font-bold transition ${lang === l ? "gradient-primary text-primary-foreground shadow-md" : "bg-muted/40 hover:bg-muted"}`}
                >
                  {l === "bn" ? "বাংলা" : "English"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold mb-2">{lang === "bn" ? "থিম" : "Theme"}</div>
            <div className="grid grid-cols-2 gap-2">
              {(["light", "dark"] as const).map((th) => (
                <button
                  key={th}
                  onClick={() => setTheme(th)}
                  className={`h-12 rounded-xl font-bold capitalize transition ${theme === th ? "gradient-primary text-primary-foreground shadow-md" : "bg-muted/40 hover:bg-muted"}`}
                >
                  {th}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
