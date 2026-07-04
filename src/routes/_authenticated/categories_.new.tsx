import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { useMyStore } from "@/lib/eazystore-data";
import { useCategories } from "@/lib/categories-data";
import { CategoryEditor } from "@/components/category-editor";

const searchSchema = z.object({
  parent: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/categories_/new")({
  head: () => ({ meta: [{ title: "New Category — EazyStore" }] }),
  validateSearch: searchSchema,
  component: NewCategoryPage,
});

function NewCategoryPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: Route.id });
  const myStore = useMyStore();
  const storeId = myStore.data?.id;
  const list = useCategories(storeId);

  if (myStore.isLoading || list.isLoading) {
    return (
      <main className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!storeId) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">No store yet</h1>
        <Link
          to="/onboarding"
          className="mt-6 inline-flex rounded-xl gradient-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
        >
          Start onboarding
        </Link>
      </main>
    );
  }

  return (
    <CategoryEditor
      mode="create"
      storeId={storeId}
      allCategories={list.data ?? []}
      parentId={search.parent ?? null}
      onDone={(created) =>
        created
          ? navigate({ to: "/categories/$id/edit", params: { id: created.id } })
          : navigate({ to: "/categories" })
      }
    />
  );
}
