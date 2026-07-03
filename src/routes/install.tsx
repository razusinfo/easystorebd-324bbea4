import { createFileRoute, Link } from "@tanstack/react-router";
import { Smartphone, Monitor, Apple, Chrome, Share, MoreVertical, Download, Home } from "lucide-react";
import { PwaInstallButton } from "@/components/pwa-install-button";
import logoAsset from "@/assets/eazystore-logo.png.asset.json";
import { EazyStoreWordmark } from "@/components/eazystore-wordmark";

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
          <img
            src={logoAsset.url}
            alt="EazyStore"
            className="mx-auto h-20 sm:h-24 w-auto object-contain drop-shadow-md"
          />
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

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700/70">
              Offline Test
            </p>
            <h2 className="text-xl font-black text-slate-900 mt-1">
              অফলাইন ক্যাশিং যাচাই করার গাইড
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              নিচের ধাপগুলো অনুসরণ করে যাচাই করুন Service Worker ও অফলাইন মোড ঠিকমতো কাজ করছে কিনা।
              <span className="font-semibold text-rose-600"> মনে রাখুন:</span> অফলাইন মোড শুধুমাত্র
              <span className="font-semibold"> Published সাইটে</span> কাজ করে — Lovable preview-তে নয়।
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl bg-emerald-50/60 border border-emerald-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Smartphone className="h-5 w-5 text-emerald-700" />
                <h3 className="font-bold text-emerald-900">Android (Chrome)</h3>
              </div>
              <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-700">
                <li>Published সাইটে যান (`.lovable.app` URL), সাইটটি একবার সম্পূর্ণ লোড হতে দিন।</li>
                <li>কিছু পেজ ব্রাউজ করুন — হোম, প্রোডাক্ট, /install ইত্যাদি।</li>
                <li>ফোনের Settings থেকে <b>Airplane Mode চালু</b> করুন (বা WiFi + Mobile Data বন্ধ)।</li>
                <li>Chrome-এ ফিরে গিয়ে পেজ <b>Refresh</b> করুন।</li>
                <li>ক্যাশ থেকে পেজ লোড হবে; নতুন পেজে গেলে <code className="rounded bg-white px-1">/offline</code> পেজ দেখাবে।</li>
                <li>ইন্টারনেট ফিরিয়ে দিলে সব স্বাভাবিকভাবে কাজ করবে।</li>
              </ol>
            </div>

            <div className="rounded-2xl bg-indigo-50/60 border border-indigo-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Monitor className="h-5 w-5 text-indigo-700" />
                <h3 className="font-bold text-indigo-900">Desktop (Chrome / Edge)</h3>
              </div>
              <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-700">
                <li>Published সাইট খুলে <b>F12</b> চেপে DevTools ওপেন করুন।</li>
                <li><b>Application</b> ট্যাব → <b>Service Workers</b> — <code className="rounded bg-white px-1">sw.js</code> "activated and running" দেখাবে।</li>
                <li>বাম পাশে <b>Cache Storage</b> → <code className="rounded bg-white px-1">eazystore-pages</code>, <code className="rounded bg-white px-1">eazystore-assets</code>, <code className="rounded bg-white px-1">eazystore-images</code> ক্যাশে ফাইল দেখতে পাবেন।</li>
                <li><b>Network</b> ট্যাবে গিয়ে উপরে <b>"Offline"</b> সিলেক্ট করুন।</li>
                <li>পেজ Refresh করুন — সাইট ক্যাশ থেকে লোড হবে, নতুন রুটে গেলে <code className="rounded bg-white px-1">/offline</code> ফলব্যাক দেখাবে।</li>
                <li>"Offline" টগল বন্ধ করে আবার Refresh — সব normal।</li>
              </ol>
            </div>
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
            <b>সমস্যা হলে:</b> DevTools → Application → Service Workers → <b>Unregister</b> চেপে
            আবার সাইট রিফ্রেশ করুন। অথবা URL-এ <code className="rounded bg-white px-1">?sw=off</code> যোগ করলে
            Service Worker বন্ধ হয়ে যাবে।
          </div>
        </section>

      </main>
    </div>
  );
}
