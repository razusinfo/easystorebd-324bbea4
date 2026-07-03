import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Plus, Search, Eye, Pencil, Trash2, Loader2, AlertCircle,
  GripVertical, ImageIcon, Upload, X, ChevronRight, ChevronDown, ExternalLink,
} from "lucide-react";
import { useMyStore } from "@/lib/eazystore-data";
import {
  useCategories, useCreateCategory, useUpdateCategory,
  useDeleteCategory, useReorderCategory, uploadCategoryImage,
  buildCategoryTree, type CategoryNode,
} from "@/lib/categories-data";

export const Route = createFileRoute("/_authenticated/categories")({
  head: () => ({ meta: [{ title: "Categories — EazyStore" }] }),
  component: CategoriesPage,
});

type ModalState =
  | { mode: "closed" }
  | { mode: "create"; parent_id: string | null }
  | { mode: "edit"; node: CategoryNode };

function CategoriesPage() {
  const myStore = useMyStore();
  const storeId = myStore.data?.id;
  const list = useCategories(storeId);

  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
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

      {/* Header card */}
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
        <button
          type="button"
          onClick={() => setModal({ mode: "create", parent_id: null })}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl gradient-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add Categories
        </button>
      </section>

      {/* Table */}
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
                storeSlug={myStore.data!.slug}
                expanded={expanded}
                onToggle={toggle}
                onEdit={(n) => setModal({ mode: "edit", node: n })}
                onAddChild={(p) => setModal({ mode: "create", parent_id: p })}
                storeId={storeId!}
              />
            ))}
          </ul>
        )}
      </section>

      {modal.mode !== "closed" && (
        <CategoryModal
          key={modal.mode === "edit" ? modal.node.id : `create-${modal.parent_id ?? "root"}`}
          state={modal}
          storeId={storeId!}
          allCategories={list.data ?? []}
          onClose={() => setModal({ mode: "closed" })}
        />
      )}
    </main>
  );
}

function CategoryRow({
  node, depth, storeSlug, storeId, expanded, onToggle, onEdit, onAddChild,
}: {
  node: CategoryNode;
  depth: number;
  storeSlug: string;
  storeId: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (n: CategoryNode) => void;
  onAddChild: (parent_id: string) => void;
}) {
  const remove = useDeleteCategory(storeId);
  const reorder = useReorderCategory(storeId);
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

        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.id)}
          className="flex min-w-0 items-center gap-3 text-left"
          style={{ paddingLeft: depth * 20 }}
        >
          {hasChildren ? (
            isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-foreground/50" />
                   : <ChevronRight className="h-4 w-4 shrink-0 text-foreground/50" />
          ) : (
            <span className="h-4 w-4 shrink-0" />
          )}
          <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted">
            {node.image_url ? (
              <img src={node.image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-4 w-4 text-foreground/40" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-foreground">{node.name}</span>
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
        </button>

        <div className="hidden text-center text-sm font-medium text-foreground/80 sm:block">
          {node.children.length}
        </div>

        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onAddChild(node.id)}
            className="hidden h-8 w-8 place-items-center rounded-md text-foreground/50 hover:bg-primary/10 hover:text-primary sm:grid"
            title="Add sub-category"
            aria-label="Add sub-category"
          >
            <Plus className="h-4 w-4" />
          </button>
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
            onClick={() => onEdit(node)}
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
              onEdit={onEdit}
              onAddChild={onAddChild}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function CategoryModal({
  state, storeId, allCategories, onClose,
}: {
  state: Exclude<ModalState, { mode: "closed" }>;
  storeId: string;
  allCategories: { id: string; name: string; parent_id: string | null }[];
  onClose: () => void;
}) {
  const create = useCreateCategory(storeId);
  const update = useUpdateCategory(storeId);
  const isEdit = state.mode === "edit";

  const [name, setName] = useState(isEdit ? state.node.name : "");
  const [parentId, setParentId] = useState<string | null>(
    isEdit ? state.node.parent_id : state.mode === "create" ? state.parent_id : null,
  );
  const [imageUrl, setImageUrl] = useState<string | null>(isEdit ? state.node.image_url : null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parentOptions = useMemo(() => {
    // Prevent selecting self or a descendant as parent when editing
    const excluded = new Set<string>();
    if (isEdit) {
      const collect = (id: string) => {
        excluded.add(id);
        allCategories.filter((c) => c.parent_id === id).forEach((c) => collect(c.id));
      };
      collect(state.node.id);
    }
    return allCategories.filter((c) => !excluded.has(c.id));
  }, [allCategories, isEdit, state]);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const url = await uploadCategoryImage(file);
      setImageUrl(url);
    } catch (err) {
      setError((err as Error)?.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setError(null);
    try {
      if (isEdit) {
        await update.mutateAsync({ id: state.node.id, name, image_url: imageUrl });
      } else {
        await create.mutateAsync({ name, parent_id: parentId, image_url: imageUrl });
      }
      onClose();
    } catch (err) {
      setError((err as Error)?.message ?? "Could not save.");
    }
  }

  const busy = create.isPending || update.isPending || uploading;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-black">
            {isEdit ? "Edit Category" : "Add Category"}
          </h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-foreground/50 hover:bg-foreground/5" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-foreground/60">Image</label>
            <div className="mt-2 flex items-center gap-3">
              <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-xl border border-border bg-muted">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-5 w-5 text-foreground/40" />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold hover:bg-foreground/5 disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {imageUrl ? "Replace" : "Upload"}
                </button>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl(null)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="cat-name" className="block text-xs font-bold uppercase tracking-wide text-foreground/60">Name</label>
            <input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              autoFocus
              placeholder="e.g. Women's Fashion"
              className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-primary/30 focus:ring-2"
            />
          </div>

          <div>
            <label htmlFor="cat-parent" className="block text-xs font-bold uppercase tracking-wide text-foreground/60">Parent (optional)</label>
            <select
              id="cat-parent"
              value={parentId ?? ""}
              onChange={(e) => setParentId(e.target.value || null)}
              className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-primary/30 focus:ring-2"
            >
              <option value="">— Top level —</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
              <AlertCircle className="h-3.5 w-3.5" /> {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold hover:bg-foreground/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || !name.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl gradient-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {(create.isPending || update.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save" : "Add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function countDescendants(node: CategoryNode): number {
  let n = node.children.length;
  for (const c of node.children) n += countDescendants(c);
  return n;
}
