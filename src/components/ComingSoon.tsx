import { PageHeader } from "@/components/layout/AppShell";
import { useI18n } from "@/lib/i18n";
import { Rocket } from "lucide-react";

export function ComingSoon({ title }: { title: string }) {
  const { t, lang } = useI18n();
  return (
    <div>
      <PageHeader title={title} />
      <div className="glass-card rounded-2xl p-12 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl gradient-primary text-primary-foreground shadow-glow animate-float">
          <Rocket className="h-8 w-8" />
        </div>
        <h2 className="mt-6 font-display text-2xl font-black">{t("comingSoon")}</h2>
        <p className="mt-2 text-muted-foreground max-w-md mx-auto">{t("moduleDesc")}</p>
        <p className="mt-4 text-xs text-muted-foreground">
          {lang === "bn" ? "প্রিভিউ মডিউল — দ্রুতই সম্পূর্ণ ফিচার সহ আসছে।" : "Preview module — full feature set arriving soon."}
        </p>
      </div>
    </div>
  );
}
