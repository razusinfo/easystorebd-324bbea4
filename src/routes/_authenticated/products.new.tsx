import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { ProductForm } from "@/components/product-form";

const searchSchema = z.object({
  from: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/products/new")({
  head: () => ({
    meta: [
      { title: "Add Product — EazyStore" },
      { name: "description", content: "Add a new product to your EazyStore inventory." },
    ],
  }),
  validateSearch: (s) => searchSchema.parse(s),
  component: NewProductPage,
});

function NewProductPage() {
  const navigate = useNavigate();
  const { from } = Route.useSearch();
  return (
    <ProductForm
      mode="new"
      duplicateFromId={from}
      onDone={() => navigate({ to: "/products" })}
      onCancel={() => navigate({ to: "/products" })}
    />
  );
}
