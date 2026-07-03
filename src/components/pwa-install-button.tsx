import { useEffect, useState } from "react";
import { Download, Check } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallButton({ className = "" }: { className?: string }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    if (standalone) setInstalled(true);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleClick() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferred(null);
  }

  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold shadow-md transition disabled:opacity-70 disabled:cursor-not-allowed";

  if (installed) {
    return (
      <button type="button" disabled className={`${base} bg-emerald-100 text-emerald-800 ${className}`}>
        <Check className="h-5 w-5" /> ইতিমধ্যে ইনস্টল করা আছে
      </button>
    );
  }

  if (isIOS && !deferred) {
    return (
      <button type="button" disabled className={`${base} bg-slate-100 text-slate-600 ${className}`}>
        <Download className="h-5 w-5" /> iPhone-এ Safari থেকে "Add to Home Screen" ব্যবহার করুন
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!deferred}
      className={`${base} bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-lg shadow-emerald-600/30 ${className}`}
    >
      <Download className="h-5 w-5" />
      {deferred ? "এখনই অ্যাপ ইনস্টল করুন" : "Install অপশনের জন্য অপেক্ষা করুন…"}
    </button>
  );
}
