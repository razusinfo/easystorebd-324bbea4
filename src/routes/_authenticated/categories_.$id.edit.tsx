import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useMyStore } from "@/lib/eazystore-data";
import { useCategories } from "@/lib/categories-data";
import { CategoryEditor } from "@/components/category-editor";

export const Route = createFileRoute("/_authenticated/categories_/$id/edit")({
  head: () => ({ meta: [{ title: "Edit Category — EasyStore" }] }),
  component: EditCategoryPage,
});

function EditCategoryPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const myStore = useMyStore();
  const storeId = myStore.data?.id;
  const list = useCategories(storeId);

  const node = useMemo(
    () => (list.data ?? []).find((c) => c.id === id) ?? null,
    [list.data, id],
  );

  if (myStore.isLoading || list.isLoading) {
    return (
      <main className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!storeId || !node) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Category not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">It may have been deleted.</p>
        <Link
          to="/categories"
          className="mt-6 inline-flex rounded-xl gradient-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
        >
          Back to categories
        </Link>
      </main>
    );
  }

  return (
    <CategoryEditor
      mode="edit"
      storeId={storeId}
      allCategories={list.data ?? []}
      node={node}
      onDone={() => navigate({ to: "/categories" })}
    />
  );
}
