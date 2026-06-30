import { Construction } from "lucide-react";

export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <main className="grid min-h-[calc(100vh-3rem)] place-items-center px-6 text-center">
      <div className="max-w-md space-y-4">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Construction className="h-7 w-7" />
        </div>
        <h1 className="font-display text-3xl font-black">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {description ?? "This module is coming soon. Stay tuned!"}
        </p>
      </div>
    </main>
  );
}
