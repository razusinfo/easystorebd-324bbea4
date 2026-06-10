import { Bell, Moon, Sun, Search, LogOut, Globe } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useSession, setSession } from "@/lib/session";
import { roleLabels } from "@/lib/mock-data";
import { MobileMenuButton } from "./Sidebar";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { lang, setLang, t } = useI18n();
  const { theme, toggle } = useTheme();
  const session = useSession();
  const navigate = useNavigate();

  const handleLogout = () => {
    setSession(null);
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/80 backdrop-blur-xl px-4 sm:px-6 h-16">
      <MobileMenuButton onClick={onMenu} />

      {/* search */}
      <div className="relative flex-1 max-w-md hidden sm:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          placeholder={t("search")}
          className="w-full h-10 pl-9 pr-3 rounded-lg bg-muted/50 border border-transparent focus:bg-card focus:border-ring outline-none text-sm transition"
        />
      </div>
      <div className="flex-1 sm:hidden" />

      {/* lang toggle */}
      <button
        type="button"
        onClick={() => setLang(lang === "bn" ? "en" : "bn")}
        className="flex items-center gap-1.5 h-10 px-3 rounded-lg bg-muted/50 hover:bg-muted text-sm font-semibold transition"
        aria-label="Toggle language"
      >
        <Globe className="h-4 w-4" />
        <span>{lang === "bn" ? "EN" : "বাং"}</span>
      </button>

      {/* theme */}
      <button
        type="button"
        onClick={toggle}
        className="grid h-10 w-10 place-items-center rounded-lg bg-muted/50 hover:bg-muted transition"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      {/* notif */}
      <button
        type="button"
        className="relative hidden sm:grid h-10 w-10 place-items-center rounded-lg bg-muted/50 hover:bg-muted transition"
      >
        <Bell className="h-4 w-4" />
        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-accent" />
      </button>

      {/* user */}
      {session && (
        <div className="flex items-center gap-3 pl-3 border-l border-border">
          <div className="hidden md:block text-right min-w-0">
            <div className="text-sm font-semibold truncate max-w-[140px]">{session.name}</div>
            <div className="text-[11px] text-muted-foreground truncate max-w-[140px]">
              {roleLabels[session.role][lang]}
            </div>
          </div>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full gradient-primary text-primary-foreground font-bold">
            {session.name.charAt(0)}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="grid h-10 w-10 place-items-center rounded-lg hover:bg-destructive/10 hover:text-destructive transition"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </header>
  );
}
