import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";

export const Route = createFileRoute("/account/returns")({
  component: ReturnsPage,
});

function ReturnsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Returns &amp; Cancellations</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Track return requests and cancelled orders here.
      </p>
      <div className="mt-10 grid place-items-center gap-2 text-center text-muted-foreground">
        <RotateCcw className="h-10 w-10" />
        <p>No return or cancellation requests.</p>
      </div>
    </div>
  );
}
