import { createFileRoute } from "@tanstack/react-router";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/account/wishlist")({
  component: WishlistPage,
});

function WishlistPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Wishlist &amp; Followed Stores</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Save products you love and follow your favorite stores.
      </p>
      <div className="mt-10 grid place-items-center gap-2 text-center text-muted-foreground">
        <Heart className="h-10 w-10" />
        <p>Nothing here yet.</p>
        <p className="text-xs">Tap the heart on any product to save it.</p>
      </div>
    </div>
  );
}
