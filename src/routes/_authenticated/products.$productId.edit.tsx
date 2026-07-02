import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProductForm } from "@/components/product-form";

export const Route = createFileRoute("/_authenticated/products/$productId/edit")({
  head: () => ({
    meta: [
      { title: "Edit Product — EazyStore" },
      { name: "description", content: "Edit an existing product in your EazyStore inventory." },
    ],
  }),
  component: EditProductPage,
});

function EditProductPage() {
  const navigate = useNavigate();
  const { productId } = Route.useParams();
  return (
    <ProductForm
      mode="edit"
      productId={productId}
      onDone={() => navigate({ to: "/products" })}
      onCancel={() => navigate({ to: "/products" })}
    />
  );
}
