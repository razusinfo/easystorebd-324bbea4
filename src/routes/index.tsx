import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Blank App" },
      { name: "description", content: "Start building your app." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen grid place-items-center bg-background text-foreground">
      <div className="text-center space-y-3 px-6">
        <h1 className="text-3xl font-bold">Blank Slate</h1>
        <p className="text-sm text-muted-foreground">
          Start prompting to build your app.
        </p>
      </div>
    </main>
  );
}
