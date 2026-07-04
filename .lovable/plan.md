## Goal

Replace the single-category dropdown on the product form with an "Assign categories" card + modal (like the screenshots), letting a product belong to multiple categories.

## Changes

**1. Database migration (new junction table)**

- Create `public.product_category_assignments` with columns: `product_id` (FK products, cascade), `category_id` (FK product_categories, cascade), primary key `(product_id, category_id)`, `created_at`.
- GRANT to authenticated + service_role.
- Enable RLS. Policies: user can manage assignments only for products in stores they own (mirroring existing `products` policy pattern).
- Keep existing `products.category_id` column intact for backward compatibility (storefront still reads it as the "primary" category).

**2. Data layer (`src/lib/eazystore-data.ts`)**

- Add `useProductCategoryAssignments(productId)` query — returns array of category IDs.
- Extend `useUpsertProduct` to accept `categoryIds: string[]`; after upsert, replace the product's assignments (delete-all + insert). Also set `products.category_id` to the first selected id for backward compatibility.

**3. Product form (`src/components/product-form.tsx`)**

- Replace the "Category" `<Field>` block with a right-column style "Category" card:
  - Header "Category" + chevron.
  - Shows selected category chips or "No assigned category found".
  - Purple "Assign category" button opens a modal.
- Modal (`Dialog`): title "Assign categories" + "+" button (links to `/categories/new` in a new tab). Body shows all categories as toggleable chips (multi-select). Footer "Done" saves selection to local form state.
- Store selection in `form.categoryIds: string[]` (replaces `categoryId` in FormState; hydrate from assignments query on edit, or from source product on duplicate).
- Pass `categoryIds` to `upsert.mutateAsync`.

## Technical notes

- Categories page and storefront filtering continue to work off `products.category_id` unchanged; multi-assignment is additive.
- Migration order: CREATE TABLE → GRANT → ENABLE RLS → CREATE POLICY (per project rules).
- Modal uses existing shadcn `Dialog` component.

## Out of scope

- Updating storefront filtering to use the junction table (can be a follow-up).
- Bulk-assign UI on the categories list page.
