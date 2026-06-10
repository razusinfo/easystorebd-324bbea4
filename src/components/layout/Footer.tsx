import { useI18n } from "@/lib/i18n";
import { Phone, Heart } from "lucide-react";

export function Footer() {
  const { t, lang } = useI18n();
  return (
    <footer className="mt-auto border-t border-border bg-card/50 backdrop-blur">
      <div className="px-4 sm:px-6 py-5 grid gap-3 sm:flex sm:items-center sm:justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Heart className="h-4 w-4 text-accent fill-accent" />
          <span>
            {t("madeBy")}{" "}
            <a
              href="https://www.softwarepointbd.com/"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-foreground hover:text-primary transition"
            >
              Software Point
            </a>
          </span>
          <span className="hidden sm:inline text-muted-foreground/50">•</span>
          <a
            href="https://www.softwarepointbd.com/"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline text-muted-foreground hover:text-primary transition"
          >
            softwarepointbd.com
          </a>
        </div>
        <a
          href="tel:01724561670"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg gradient-primary text-primary-foreground font-semibold text-sm shadow-md hover:shadow-glow transition"
        >
          <Phone className="h-4 w-4" />
          <span>{t("hotline")}: {lang === "bn" ? "০১৭২৪-৫৬১৬৭০" : "01724-561670"}</span>
        </a>
      </div>
    </footer>
  );
}
