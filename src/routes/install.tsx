import { createFileRoute, Link } from "@tanstack/react-router";
import { Smartphone, Monitor, Apple, Chrome, Share, MoreVertical, Download, Home } from "lucide-react";
import { PwaInstallButton } from "@/components/pwa-install-button";

export const Route = createFileRoute("/install")({
  head: () => ({
    meta: [
      { title: "EazyStore অ্যাপ ইনস্টল করুন — মোবাইল ও ডেস্কটপ গাইড" },
      { name: "description", content: "EazyStore কে আপনার ফোন বা কম্পিউটারে অ্যাপের মতো ইনস্টল করুন। Android, iPhone, Windows ও Mac-এর জন্য সহজ ধাপে ধাপে গাইড।" },
    ],
  }),
  component: InstallPage,
});

type Step = { text: string; icon?: React.ComponentType<{ className?: string }> };
type Guide = {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  steps: Step[];
};

const GUIDES: Guide[] = [
  {
    title: "Android (Chrome)",
    subtitle: "মোবাইল ফোন",
    icon: Smartphone,
    color: "bg-emerald-600",
    steps: [
      { text: "Chrome ব্রাউজারে এই সাইটটি খুলুন।", icon: Chrome },
      { text: "উপরে ডান পাশে তিন-ডট মেনু (⋮) চাপুন।", icon: MoreVertical },
      { text: "\"Install app\" বা \"Add to Home screen\" অপশনে চাপুন।", icon: Download },
      { text: "\"Install\" চেপে নিশ্চিত করুন — হোম স্ক্রিনে আইকন চলে আসবে।", icon: Home },
    ],
  },
  {
    title: "iPhone / iPad (Safari)",
    subtitle: "মোবাইল ফোন",
    icon: Apple,
    color: "bg-slate-800",
    steps: [
      { text: "Safari ব্রাউজারে সাইটটি খুলুন (Chrome-এ কাজ করবে না)।", icon: Apple },
      { text: "নিচের \"Share\" বাটনে (⬆️) চাপুন।", icon: Share },
      { text: "স্ক্রল করে \"Add to Home Screen\" সিলেক্ট করুন।", icon: Home },
      { text: "উপরে ডান পাশে \"Add\" চাপুন — আইকন হোম স্ক্রিনে যোগ হবে।", icon: Download },
    ],
  },
  {
    title: "Windows / Mac (Chrome, Edge)",
    subtitle: "কম্পিউটার",
    icon: Monitor,
    color: "bg-indigo-600",
    steps: [
      { text: "Chrome অথবা Microsoft Edge-এ সাইটটি খুলুন।", icon: Chrome },
      { text: "URL বারের ডান পাশে ইনস্টল আইকন (⬇️/💻) দেখলে সেটি চাপুন।", icon: Download },
      { text: "না দেখলে মেনু (⋮) → \"Install EazyStore…\" সিলেক্ট করুন।", icon: MoreVertical },
      { text: "\"Install\" চেপে নিশ্চিত করুন — ডেস্কটপ/টাস্কবারে অ্যাপ চালু হবে।", icon: Monitor },
    ],
  },
];

function InstallPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
      <header className="border-b border-emerald-100 bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-4xl px-5 py-5 flex items-center justify-between">
          <Link to="/" className="text-sm font-semibold text-emerald-700 hover:underline">
            ← হোম
          </Link>
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-700/70">
            Install Guide
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10 space-y-10">
        <section className="text-center space-y-3">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
            <Download className="h-8 w-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-emerald-900">
            EazyStore অ্যাপ ইনস্টল করুন
          </h1>
          <p className="mx-auto max-w-xl text-sm sm:text-base text-slate-600">
            কোনো Play Store বা App Store লাগবে না। সরাসরি ব্রাউজার থেকেই আপনার ফোন ও কম্পিউটারে
            অ্যাপের মতো ইনস্টল করে ব্যবহার করতে পারবেন — দ্রুত, ফুলস্ক্রিন এবং হোম স্ক্রিনে আইকনসহ।
          </p>
          <div className="pt-2"><PwaInstallButton /></div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {GUIDES.map((g) => {
            const Icon = g.icon;
            return (
              <article
                key={g.title}
                className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className={`grid h-11 w-11 place-items-center rounded-xl text-white ${g.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {g.subtitle}
                    </p>
                    <h2 className="text-base font-bold text-slate-900">{g.title}</h2>
                  </div>
                </div>
                <ol className="space-y-3">
                  {g.steps.map((s, i) => {
                    const SIcon = s.icon;
                    return (
                      <li key={i} className="flex gap-3">
                        <span className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm leading-relaxed text-slate-700">{s.text}</p>
                        </div>
                        {SIcon && (
                          <SIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600/70" />
                        )}
                      </li>
                    );
                  })}
                </ol>
              </article>
            );
          })}
        </section>

        <section className="rounded-2xl bg-emerald-50 border border-emerald-100 p-5 text-sm text-emerald-900">
          <p className="font-semibold mb-1">টিপস</p>
          <ul className="list-disc pl-5 space-y-1 text-emerald-800/90">
            <li>Install অপশন না দেখলে সাইটটি একবার পুরোপুরি লোড হতে দিন, তারপর আবার চেষ্টা করুন।</li>
            <li>iPhone-এ শুধু Safari দিয়ে ইনস্টল করা যায় — Chrome-এ Add to Home Screen নেই।</li>
            <li>ইনস্টলের পর অ্যাপ আইকন থেকেই সরাসরি লগইন ও অর্ডার ম্যানেজ করতে পারবেন।</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
