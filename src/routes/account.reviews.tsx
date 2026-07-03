import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";

export const Route = createFileRoute("/account/reviews")({
  component: ReviewsPage,
});

function ReviewsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">My Reviews</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Reviews you've written on products and stores.
      </p>
      <div className="mt-10 grid place-items-center gap-2 text-center text-muted-foreground">
        <Star className="h-10 w-10" />
        <p>You haven't written any reviews yet.</p>
      </div>
    </div>
  );
}
