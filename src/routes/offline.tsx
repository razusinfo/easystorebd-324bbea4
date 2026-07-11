import { createFileRoute, Link } from "@tanstack/react-router";
import { WifiOff, RotateCw, Home } from "lucide-react";
import { useEffect, useState } from "react";
import logoAsset from "@/assets/eazystore-logo.png.asset.json";

export const Route = createFileRoute("/offline")({
  head: () => ({
    meta: [
      { title: "অফলাইন — EasyStore" },
      { name: "description", content: "ইন্টারনেট সংযোগ নেই। EasyStore অফলাইন মোডে আছে।" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OfflinePage,
});

function OfflinePage() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white flex items-center justify-center px-5">
      <div className="max-w-md w-full text-center space-y-6">
        <img
          src={logoAsset.url}
          alt="EasyStore"
          className="mx-auto h-16 w-auto object-contain opacity-80"
        />
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-600/10 text-emerald-700">
          <WifiOff className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-emerald-900">আপনি এখন অফলাইনে আছেন</h1>
          <p className="text-sm text-slate-600">
            ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না। সংযোগ ফিরে এলে পেজটি আবার লোড করুন।
          </p>
          <p className={`text-xs font-semibold ${online ? "text-emerald-600" : "text-rose-600"}`}>
            {online ? "● সংযোগ ফিরে এসেছে — এখন রিফ্রেশ করতে পারেন" : "● কোনো সংযোগ নেই"}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition"
          >
            <RotateCw className="h-4 w-4" /> আবার চেষ্টা করুন
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-5 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50 transition"
          >
            <Home className="h-4 w-4" /> হোমে ফিরুন
          </Link>
        </div>
      </div>
    </div>
  );
}
