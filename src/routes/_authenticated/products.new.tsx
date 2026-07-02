import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProductForm } from "@/components/product-form";

export const Route = createFileRoute("/_authenticated/products/new")({
  head: () => ({
    meta: [
      { title: "Add Product — EazyStore" },
      { name: "description", content: "Add a new product to your EazyStore inventory." },
    ],
  }),
  component: NewProductPage,
});

function NewProductPage() {
  const navigate = useNavigate();
  return (
    <ProductForm
      mode="new"
      onDone={() => navigate({ to: "/products" })}
      onCancel={() => navigate({ to: "/products" })}
    />
  );
}
