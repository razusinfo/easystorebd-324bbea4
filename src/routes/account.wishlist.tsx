import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/account/wishlist")({
  component: WishlistPage,
});

type TabKey = "wishlist" | "past" | "followed";

const TABS: { key: TabKey; label: (n: number) => string }[] = [
  { key: "wishlist", label: (n) => `My Wishlist (${n})` },
  { key: "past", label: () => "Past Purchases" },
  { key: "followed", label: () => "Followed Stores" },
];

function WishlistPage() {
  const [tab, setTab] = useState<TabKey>("wishlist");
  const wishlistCount = 0;

  return (
    <div>
      {/* Grey header band */}
      <div className="-mx-4 border-y bg-muted/60 px-4 py-4 sm:-mx-6 sm:px-6">
        <h1 className="text-xl font-semibold">Wishlist &amp; Followed Stores</h1>
      </div>

      {/* Tabs */}
      <div className="mt-4 border-b">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`-mb-px border-b-2 pb-2 pt-1 transition ${
                  active
                    ? "border-primary font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label(wishlistCount)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action bar */}
      {tab === "wishlist" && (
        <div className="mt-4 flex items-center justify-between rounded-md bg-background px-4 py-3 shadow-sm">
          <button
            type="button"
            disabled={wishlistCount === 0}
            className="text-sm font-semibold uppercase tracking-wide text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add all to cart
          </button>
        </div>
      )}

      {/* Empty state */}
      <div className="mt-10 grid place-items-center gap-2 text-center text-muted-foreground">
        <Heart className="h-10 w-10" />
        {tab === "wishlist" && (
          <>
            <p>Your wishlist is empty.</p>
            <p className="text-xs">Tap the heart on any product to save it.</p>
          </>
        )}
        {tab === "past" && <p>No past purchases yet.</p>}
        {tab === "followed" && <p>You haven't followed any stores yet.</p>}
      </div>
    </div>
  );
}
