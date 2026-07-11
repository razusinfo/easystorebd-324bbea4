import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft, Plus, Search, Eye, Pencil, Trash2, Loader2,
  GripVertical, ImageIcon, ChevronRight, ChevronDown, ExternalLink,
} from "lucide-react";
import { useMyStore } from "@/lib/eazystore-data";
import {
  useCategories, useDeleteCategory, useReorderCategory,
  buildCategoryTree, type CategoryNode,
} from "@/lib/categories-data";

export const Route = createFileRoute("/_authenticated/categories")({
  head: () => ({ meta: [{ title: "Categories — EasyStore" }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const myStore = useMyStore();
  const storeId = myStore.data?.id;
  const list = useCategories(storeId);

  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const tree = useMemo(() => buildCategoryTree(list.data ?? []), [list.data]);

  const filteredTree = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tree;
    const filter = (nodes: CategoryNode[]): CategoryNode[] =>
      nodes
        .map((n) => ({ ...n, children: filter(n.children) }))
        .filter((n) => n.name.toLowerCase().includes(q) || n.children.length > 0);
    return filter(tree);
  }, [tree, query]);

  function toggle(id: string) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  if (myStore.isLoading || list.isLoading) {
    return (
      <main className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!myStore.data) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-5 text-center">
        <div className="max-w-sm space-y-4">
          <h1 className="font-display text-2xl font-bold">No store yet</h1>
          <p className="text-sm text-muted-foreground">Finish onboarding to start adding categories.</p>
          <Link to="/onboarding" className="inline-flex items-center justify-center rounded-2xl gradient-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-md">
            Start onboarding
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 pb-24 pt-4 lg:pb-8">
      <div className="mb-3 lg:hidden">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/70 hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
      </div>

      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
        <h1 className="mr-auto font-display text-2xl font-black tracking-tight">Categories</h1>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-10 w-40 rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none ring-primary/30 focus:ring-2 sm:w-56"
          />
        </div>
        <Link
          to="/categories/new"
          className="inline-flex h-10 items-center gap-1.5 rounded-xl gradient-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add Categories
        </Link>
      </section>

      <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="hidden grid-cols-[40px_1fr_180px_140px] items-center border-b border-border bg-muted/40 px-3 py-3 text-xs font-bold uppercase tracking-wide text-foreground/60 sm:grid">
          <span />
          <span>Categories</span>
          <span className="text-center">Total Subcategory</span>
          <span className="text-right pr-2">Actions</span>
        </div>

        {filteredTree.length === 0 ? (
          <div className="p-10 text-center text-sm text-foreground/60">
            {query ? "No categories match your search." : "No categories yet — click + Add Categories to start."}
          </div>
        ) : (
          <ul>
            {filteredTree.map((node) => (
              <CategoryRow
                key={node.id}
                node={node}
                depth={0}
                storeSlug={myStore.data!.slug ?? ""}
                expanded={expanded}
                onToggle={toggle}
                storeId={storeId!}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function CategoryRow({
  node, depth, storeSlug, storeId, expanded, onToggle,
}: {
  node: CategoryNode;
  depth: number;
  storeSlug: string;
  storeId: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const remove = useDeleteCategory(storeId);
  const reorder = useReorderCategory(storeId);
  const navigate = useNavigate();
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);

  async function onDelete() {
    const n = countDescendants(node);
    const msg = n > 0
      ? `Delete "${node.name}" and ${n} sub-categor${n === 1 ? "y" : "ies"}? This cannot be undone.`
      : `Delete "${node.name}"?`;
    if (!window.confirm(msg)) return;
    try { await remove.mutateAsync(node.id); } catch (e) {
      window.alert((e as Error)?.message ?? "Could not delete.");
    }
  }

  return (
    <li className="border-b border-border last:border-b-0">
      <div className="grid grid-cols-[40px_1fr_auto] items-center gap-2 px-3 py-3 hover:bg-muted/30 sm:grid-cols-[40px_1fr_180px_140px]">
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-md text-foreground/30 hover:bg-foreground/5 hover:text-foreground/60"
          aria-label="Drag to reorder"
          title="Reorder"
          onClick={() => reorder.mutateAsync({ id: node.id, sort_order: node.sort_order })}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex min-w-0 items-center gap-3" style={{ paddingLeft: depth * 20 }}>
          <button
            type="button"
            onClick={() => hasChildren && onToggle(node.id)}
            className="grid h-6 w-6 shrink-0 place-items-center rounded text-foreground/50 hover:bg-foreground/5 disabled:opacity-30"
            disabled={!hasChildren}
            aria-label={isOpen ? "Collapse" : "Expand"}
          >
            {hasChildren ? (
              isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            ) : (
              <span className="h-4 w-4" />
            )}
          </button>
          <Link
            to="/categories/$id/edit"
            params={{ id: node.id }}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            title="Edit category"
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted">
              {node.image_url ? (
                <img src={node.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-4 w-4 text-foreground/40" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-foreground hover:text-primary">{node.name}</span>
                <Link
                  to="/s/$slug"
                  params={{ slug: storeSlug }}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-primary/70 hover:text-primary"
                  title="Open storefront"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="text-xs text-foreground/60">
                {node.children.length} subcategor{node.children.length === 1 ? "y" : "ies"}
              </div>
            </div>
          </Link>
        </div>


        <div className="hidden text-center text-sm font-medium text-foreground/80 sm:block">
          {node.children.length}
        </div>

        <div className="flex items-center justify-end gap-1">
          <Link
            to="/categories/$id/edit"
            params={{ id: node.id }}
            className="hidden h-8 w-8 place-items-center rounded-md text-foreground/50 hover:bg-primary/10 hover:text-primary sm:grid"
            title="Add sub-category"
            aria-label="Add sub-category"
          >
            <Plus className="h-4 w-4" />
          </Link>

          <button
            type="button"
            onClick={() => hasChildren ? onToggle(node.id) : undefined}
            className="grid h-8 w-8 place-items-center rounded-md text-foreground/50 hover:bg-primary/10 hover:text-primary disabled:opacity-30"
            disabled={!hasChildren}
            title={hasChildren ? "Show sub-categories" : "No sub-categories"}
            aria-label="View"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate({ to: "/categories/$id/edit", params: { id: node.id } })}
            className="grid h-8 w-8 place-items-center rounded-md text-foreground/50 hover:bg-primary/10 hover:text-primary"
            title="Edit"
            aria-label="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={remove.isPending}
            className="grid h-8 w-8 place-items-center rounded-md text-red-500 hover:bg-red-50 disabled:opacity-50"
            title="Delete"
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isOpen && hasChildren && (
        <ul className="bg-muted/10">
          {node.children.map((c) => (
            <CategoryRow
              key={c.id}
              node={c}
              depth={depth + 1}
              storeSlug={storeSlug}
              storeId={storeId}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function countDescendants(node: CategoryNode): number {
  let n = node.children.length;
  for (const c of node.children) n += countDescendants(c);
  return n;
}
