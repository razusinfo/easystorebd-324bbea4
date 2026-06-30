import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft, FolderTree, Plus, ChevronRight, ChevronDown,
  Pencil, Trash2, Check, X, Loader2, AlertCircle, FolderPlus,
  ArrowUp, ArrowDown,
} from "lucide-react";
import { useMyStore } from "@/lib/eazystore-data";
import {
  useCategories, useCreateCategory, useRenameCategory,
  useDeleteCategory, useReorderCategory,
  buildCategoryTree, type CategoryNode,
} from "@/lib/categories-data";

export const Route = createFileRoute("/_authenticated/categories")({
  head: () => ({ meta: [{ title: "Categories — EazyStore" }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const myStore = useMyStore();
  const storeId = myStore.data?.id;
  const list = useCategories(storeId);
  const create = useCreateCategory(storeId);

  const [rootName, setRootName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const tree = useMemo(() => buildCategoryTree(list.data ?? []), [list.data]);
  const total = list.data?.length ?? 0;

  async function addRoot() {
    setError(null);
    const name = rootName.trim();
    if (!name) return;
    try {
      await create.mutateAsync({ name, parent_id: null });
      setRootName("");
    } catch (e: any) {
      setError(e?.message ?? "Could not add category.");
    }
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
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl gradient-primary text-white">
            <FolderTree className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-bold">No store yet</h1>
          <p className="text-sm text-muted-foreground">
            Finish onboarding to start organizing your products into categories.
          </p>
          <Link
            to="/onboarding"
            className="inline-flex items-center justify-center rounded-2xl gradient-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-md"
          >
            Start onboarding
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl bg-gradient-to-b from-[#eee6fb] via-[#efe9fc] to-[#f4eefd] pb-28">
      <section className="px-5 pt-5">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/70 hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-black tracking-tight">Categories</h1>
            <p className="mt-1 text-sm text-foreground/70">
              Organize products in unlimited levels — categories, sub-categories, and deeper.
            </p>
          </div>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
            {total} total
          </span>
        </div>
      </section>

      {/* Add root */}
      <section className="mt-4 px-5">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <label htmlFor="new-root" className="block font-display text-sm font-black">
            New top-level category
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id="new-root"
              value={rootName}
              onChange={(e) => { setRootName(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") addRoot(); }}
              maxLength={80}
              placeholder="e.g. Men's Clothing"
              className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-medium outline-none ring-primary/30 focus:ring-2"
            />
            <button
              type="button"
              onClick={addRoot}
              disabled={create.isPending || !rootName.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </button>
          </div>
          {error && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600">
              <AlertCircle className="h-3.5 w-3.5" /> {error}
            </p>
          )}
        </div>
      </section>

      {/* Tree */}
      <section className="mt-4 px-5">
        {tree.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-foreground/20 bg-white/60 p-8 text-center">
            <FolderTree className="mx-auto h-8 w-8 text-foreground/40" />
            <p className="mt-2 text-sm font-medium text-foreground/70">No categories yet</p>
            <p className="text-xs text-foreground/50">Add your first top-level category above.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-2 shadow-sm">
            <ul className="space-y-1">
              {tree.map((node, idx) => (
                <CategoryItem
                  key={node.id}
                  node={node}
                  depth={0}
                  storeId={storeId!}
                  siblings={tree}
                  index={idx}
                />
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}

function CategoryItem({
  node, depth, storeId, siblings, index,
}: {
  node: CategoryNode;
  depth: number;
  storeId: string;
  siblings: CategoryNode[];
  index: number;
}) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [addingChild, setAddingChild] = useState(false);
  const [childName, setChildName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const rename = useRenameCategory(storeId);
  const remove = useDeleteCategory(storeId);
  const create = useCreateCategory(storeId);
  const reorder = useReorderCategory(storeId);

  const hasChildren = node.children.length > 0;

  async function onRename() {
    setLocalError(null);
    try {
      await rename.mutateAsync({ id: node.id, name: editName });
      setEditing(false);
    } catch (e: any) {
      setLocalError(e?.message ?? "Could not rename.");
    }
  }

  async function onAddChild() {
    setLocalError(null);
    const name = childName.trim();
    if (!name) return;
    try {
      await create.mutateAsync({ name, parent_id: node.id });
      setChildName("");
      setAddingChild(false);
      setOpen(true);
    } catch (e: any) {
      setLocalError(e?.message ?? "Could not add sub-category.");
    }
  }

  async function onDelete() {
    const count = countDescendants(node);
    const msg = count > 0
      ? `Delete "${node.name}" and ${count} sub-categor${count === 1 ? "y" : "ies"}? This cannot be undone.`
      : `Delete "${node.name}"?`;
    if (!window.confirm(msg)) return;
    try { await remove.mutateAsync(node.id); } catch (e: any) {
      setLocalError(e?.message ?? "Could not delete.");
    }
  }

  async function move(dir: -1 | 1) {
    const target = siblings[index + dir];
    if (!target) return;
    // Swap sort_order values. If both share the same default 0, assign by index first.
    const a = node.sort_order || index;
    const b = target.sort_order || (index + dir);
    const aNew = b === a ? a + dir : b;
    const bNew = b === a ? a : a;
    await Promise.all([
      reorder.mutateAsync({ id: node.id, sort_order: aNew }),
      reorder.mutateAsync({ id: target.id, sort_order: bNew }),
    ]);
  }

  return (
    <li>
      <div
        className="group flex items-center gap-1 rounded-xl px-2 py-1.5 hover:bg-primary/5"
        style={{ paddingLeft: 8 + depth * 18 }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-foreground/60 hover:bg-primary/10 hover:text-primary"
          aria-label={open ? "Collapse" : "Expand"}
        >
          {hasChildren ? (
            open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            <span className="block h-1.5 w-1.5 rounded-full bg-foreground/25" />
          )}
        </button>

        {editing ? (
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onRename(); if (e.key === "Escape") setEditing(false); }}
              maxLength={80}
              className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2 py-1 text-sm outline-none ring-primary/30 focus:ring-2"
            />
            <button onClick={onRename} disabled={rename.isPending} className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50" aria-label="Save">
              {rename.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => { setEditing(false); setEditName(node.name); }} className="grid h-7 w-7 place-items-center rounded-md border border-border bg-background hover:bg-foreground/5" aria-label="Cancel">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground/90">
              {node.name}
              {hasChildren && (
                <span className="ml-1.5 rounded-md bg-foreground/5 px-1.5 py-0.5 text-[10px] font-bold text-foreground/60">
                  {node.children.length}
                </span>
              )}
            </span>
            <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
              <button onClick={() => move(-1)} disabled={index === 0 || reorder.isPending} className="grid h-7 w-7 place-items-center rounded-md text-foreground/60 hover:bg-primary/10 hover:text-primary disabled:opacity-30" aria-label="Move up">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => move(1)} disabled={index === siblings.length - 1 || reorder.isPending} className="grid h-7 w-7 place-items-center rounded-md text-foreground/60 hover:bg-primary/10 hover:text-primary disabled:opacity-30" aria-label="Move down">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => { setAddingChild((v) => !v); setOpen(true); }} className="grid h-7 w-7 place-items-center rounded-md text-foreground/60 hover:bg-primary/10 hover:text-primary" aria-label="Add sub-category" title="Add sub-category">
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => { setEditing(true); setEditName(node.name); }} className="grid h-7 w-7 place-items-center rounded-md text-foreground/60 hover:bg-primary/10 hover:text-primary" aria-label="Rename">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={onDelete} disabled={remove.isPending} className="grid h-7 w-7 place-items-center rounded-md text-red-500 hover:bg-red-50 disabled:opacity-50" aria-label="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>

      {localError && (
        <p className="ml-8 flex items-center gap-1.5 px-2 pb-1 text-xs font-medium text-red-600">
          <AlertCircle className="h-3.5 w-3.5" /> {localError}
        </p>
      )}

      {addingChild && (
        <div className="flex flex-wrap gap-1.5 px-2 py-1.5" style={{ paddingLeft: 8 + (depth + 1) * 18 + 24 }}>
          <input
            autoFocus
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onAddChild(); if (e.key === "Escape") setAddingChild(false); }}
            placeholder="Sub-category name"
            maxLength={80}
            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none ring-primary/30 focus:ring-2"
          />
          <button onClick={onAddChild} disabled={create.isPending || !childName.trim()} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
          </button>
          <button onClick={() => { setAddingChild(false); setChildName(""); }} className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-bold text-foreground/70 hover:bg-foreground/5">
            Cancel
          </button>
        </div>
      )}

      {open && hasChildren && (
        <ul className="space-y-1">
          {node.children.map((c, i) => (
            <CategoryItem
              key={c.id}
              node={c}
              depth={depth + 1}
              storeId={storeId}
              siblings={node.children}
              index={i}
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
