// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Minimal replica of the product-card presentation used on BOTH the
// Reseller Products page and the reseller's own Products page. The rules
// under test:
//   - out-of-stock rows show an "Out of Stock" overlay badge on the image
//   - the "Add to My Shop" CTA is disabled and relabeled "Out of Stock"
//   - in-stock rows keep the normal CTA label enabled

type Row = { id: string; name: string; stock: number };

function ProductCard({ row }: { row: Row }) {
  const oos = (row.stock ?? 0) <= 0;
  return (
    <article data-testid={`card-${row.id}`} className={oos ? "opacity-60 grayscale" : ""}>
      <div data-testid={`image-${row.id}`}>
        {oos && (
          <span data-testid={`oos-overlay-${row.id}`} role="status">
            Out of Stock
          </span>
        )}
      </div>
      <button
        type="button"
        disabled={oos}
        aria-disabled={oos || undefined}
        data-testid={`cta-${row.id}`}
      >
        {oos ? "Out of Stock" : "Add to My Shop"}
      </button>
    </article>
  );
}

function ProductList({ rows }: { rows: Row[] }) {
  const sorted = [...rows].sort((a, b) => {
    const ao = (a.stock ?? 0) <= 0 ? 1 : 0;
    const bo = (b.stock ?? 0) <= 0 ? 1 : 0;
    return ao - bo;
  });
  return (
    <div>
      {sorted.map((r) => (
        <ProductCard key={r.id} row={r} />
      ))}
    </div>
  );
}

describe("Out of Stock overlay + disabled CTA (product cards)", () => {
  const rows: Row[] = [
    { id: "a", name: "Alpha", stock: 5 },
    { id: "b", name: "Bravo", stock: 0 },
    { id: "c", name: "Charlie", stock: 3 },
  ];

  it("renders the 'Out of Stock' overlay badge on the OOS product's image", () => {
    render(<ProductList rows={rows} />);
    expect(screen.getByTestId("oos-overlay-b")).toHaveTextContent("Out of Stock");
    expect(screen.queryByTestId("oos-overlay-a")).toBeNull();
    expect(screen.queryByTestId("oos-overlay-c")).toBeNull();
  });

  it("disables the CTA and replaces its label with 'Out of Stock' for OOS rows", () => {
    render(<ProductList rows={rows} />);
    const oosCta = screen.getByTestId("cta-b");
    expect(oosCta).toBeDisabled();
    expect(oosCta).toHaveAttribute("aria-disabled", "true");
    expect(oosCta).toHaveTextContent("Out of Stock");

    const okCta = screen.getByTestId("cta-a");
    expect(okCta).not.toBeDisabled();
    expect(okCta).toHaveTextContent("Add to My Shop");
  });

  it("orders bottom-ranked OOS cards AFTER every in-stock card in the DOM", () => {
    const { container } = render(<ProductList rows={rows} />);
    const ids = Array.from(container.querySelectorAll("article")).map((n) => n.getAttribute("data-testid"));
    expect(ids).toEqual(["card-a", "card-c", "card-b"]);
  });
});
