import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Search,
  Plus,
  Upload,
  Loader2,
  AlertCircle,
  ImageIcon,
  Package,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";
import {
  type CategoryRow,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
  uploadCategoryImage,
} from "@/lib/categories-data";

type Props =
  | {
      mode: "edit";
      storeId: string;
      allCategories: CategoryRow[];
      node: CategoryRow;
      onDone: (row?: CategoryRow) => void;
    }
  | {
      mode: "create";
      storeId: string;
      allCategories: CategoryRow[];
      parentId: string | null;
      onDone: (row?: CategoryRow) => void;
    };

const NAME_MAX = 50;

export function CategoryEditor(props: Props) {
  const { mode, storeId, allCategories, onDone } = props;
  const isEdit = mode === "edit";
  const node = isEdit ? props.node : null;
  const initialParent = isEdit ? props.node.parent_id : props.parentId;

  const create = useCreateCategory(storeId);
  const update = useUpdateCategory(storeId);
  const remove = useDeleteCategory(storeId);
  const navigate = useNavigate();

  const [name, setName] = useState(node?.name ?? "");
  const [description, setDescription] = useState(node?.description ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(node?.image_url ?? null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(node?.banner_url ?? null);
  const [parentId, setParentId] = useState<string | null>(initialParent ?? null);
  const [uploadingKind, setUploadingKind] = useState<null | "image" | "banner">(null);
  const [error, setError] = useState<string | null>(null);
  const [subQuery, setSubQuery] = useState("");

  const imgRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const parent = useMemo(
    () => (parentId ? allCategories.find((c) => c.id === parentId) ?? null : null),
    [allCategories, parentId],
  );

  const parentOptions = useMemo(() => {
    const excluded = new Set<string>();
    if (isEdit && node) {
      const collect = (id: string) => {
        excluded.add(id);
        allCategories.filter((c) => c.parent_id === id).forEach((c) => collect(c.id));
      };
      collect(node.id);
    }
    return allCategories.filter((c) => !excluded.has(c.id));
  }, [allCategories, isEdit, node]);

  const subCategories = useMemo(() => {
    if (!isEdit || !node) return [];
    const q = subQuery.trim().toLowerCase();
    return allCategories
      .filter((c) => c.parent_id === node.id)
      .filter((c) => (q ? c.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }, [allCategories, isEdit, node, subQuery]);

  async function pick(e: React.ChangeEvent<HTMLInputElement>, kind: "image" | "banner") {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError("File is larger than 4MB.");
      return;
    }
    setError(null);
    setUploadingKind(kind);
    try {
      const url = await uploadCategoryImage(file);
      if (kind === "image") setImageUrl(url);
      else setBannerUrl(url);
    } catch (err) {
      setError((err as Error)?.message ?? "Upload failed.");
    } finally {
      setUploadingKind(null);
    }
  }

  async function submit() {
    setError(null);
    try {
      if (isEdit && node) {
        await update.mutateAsync({
          id: node.id,
          name,
          image_url: imageUrl,
          banner_url: bannerUrl,
          description: description.trim() || null,
        });
        onDone(node);
      } else {
        const row = await create.mutateAsync({
          name,
          parent_id: parentId,
          image_url: imageUrl,
          banner_url: bannerUrl,
          description: description.trim() || null,
        });
        onDone(row);
      }
    } catch (err) {
      setError((err as Error)?.message ?? "Could not save.");
    }
  }

  async function deleteSub(id: string, name: string) {
    if (!window.confirm(`Delete sub-category "${name}"?`)) return;
    try {
      await remove.mutateAsync(id);
    } catch (e) {
      window.alert((e as Error)?.message ?? "Could not delete.");
    }
  }

  const busy = create.isPending || update.isPending || uploadingKind !== null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 pb-24 pt-4 lg:pb-8">
      {/* Header bar */}
      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-white p-3 shadow-sm">
        <Link
          to="/categories"
          className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground/70 hover:bg-foreground/5"
          aria-label="Back to categories"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Link to="/categories" className="font-semibold text-foreground/70 hover:text-primary">
            Categories
          </Link>
          <span className="text-foreground/40">›</span>
          <span className="truncate font-bold uppercase tracking-wide text-foreground">
            {isEdit ? node!.name : parent ? parent.name : "New Category"}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-label="Search"
            className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground/60 hover:bg-foreground/5"
          >
            <Search className="h-4 w-4" />
          </button>
          {isEdit && (
            <Link
              to="/categories/new"
              search={{ parent: node!.id }}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl gradient-primary px-3.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Add Sub Categories
            </Link>
          )}
        </div>
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Editor */}
        <section className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-6">
          {/* Banner / cover */}
          <div>
            <label className="block text-sm font-bold text-foreground">Banner/Cover</label>
            <div
              className="mt-2 relative overflow-hidden rounded-xl border border-border bg-muted"
              style={{ aspectRatio: "1300 / 380" }}
            >
              {bannerUrl ? (
                <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-foreground/30">
                  <ImageIcon className="h-8 w-8" />
                </div>
              )}
              <button
                type="button"
                onClick={() => bannerRef.current?.click()}
                disabled={uploadingKind === "banner"}
                className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-xl bg-white/95 px-4 py-2 text-sm font-bold text-primary shadow-md hover:bg-white disabled:opacity-60"
              >
                {uploadingKind === "banner" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {bannerUrl ? "Replace Image" : "Add Image"}
              </button>
              {bannerUrl && (
                <button
                  type="button"
                  onClick={() => setBannerUrl(null)}
                  className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-md bg-white/90 text-red-600 shadow hover:bg-white"
                  aria-label="Remove banner"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <input
                ref={bannerRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pick(e, "banner")}
              />
            </div>
            <p className="mt-2 text-xs italic text-foreground/60">
              N.B: Upload a banner image for the category. Recommended{" "}
              <span className="rounded bg-primary/10 px-1 not-italic font-semibold text-primary">
                size is 1300×380 pixels
              </span>
              . Maximum file size is 4MB.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Square image */}
            <div>
              <label className="block text-sm font-bold text-foreground">Image</label>
              <div
                className="mt-2 relative overflow-hidden rounded-xl border border-border bg-muted"
                style={{ aspectRatio: "1 / 1" }}
              >
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-foreground/30">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => imgRef.current?.click()}
                  disabled={uploadingKind === "image"}
                  className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-xl bg-white/95 px-4 py-2 text-sm font-bold text-primary shadow-md hover:bg-white disabled:opacity-60"
                >
                  {uploadingKind === "image" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {imageUrl ? "Replace Image" : "Add Image"}
                </button>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl(null)}
                    className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-md bg-white/90 text-red-600 shadow hover:bg-white"
                    aria-label="Remove image"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <input
                  ref={imgRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => pick(e, "image")}
                />
              </div>
              <p className="mt-2 text-xs italic text-foreground/60">
                N.B: Upload a square image for the category (1:1) aspect ratio. Recommended size is
                500×500 pixels. Maximum file size is 4MB.
              </p>
            </div>

            {/* Fields */}
            <div className="space-y-4">
              <div>
                <label htmlFor="cat-name" className="block text-sm font-bold text-foreground">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="cat-name"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
                  autoFocus
                  placeholder="e.g. SMART GADGETS"
                  className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-primary/30 focus:ring-2"
                />
                <div className="mt-1 text-right text-xs text-foreground/60">
                  Character limit: {NAME_MAX - name.length}
                </div>
              </div>

              {!isEdit && (
                <div>
                  <label htmlFor="cat-parent" className="block text-sm font-bold text-foreground">
                    Parent (optional)
                  </label>
                  <select
                    id="cat-parent"
                    value={parentId ?? ""}
                    onChange={(e) => setParentId(e.target.value || null)}
                    className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-primary/30 focus:ring-2"
                  >
                    <option value="">— Top level —</option>
                    {parentOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="cat-desc" className="block text-sm font-bold text-foreground">
                  Short Description
                </label>
                <textarea
                  id="cat-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  placeholder="Short description..."
                  className="mt-2 w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-primary/30 focus:ring-2"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-red-600">
              <AlertCircle className="h-3.5 w-3.5" /> {error}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onDone()}
              className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold hover:bg-foreground/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || !name.trim()}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl gradient-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {(create.isPending || update.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {isEdit ? "Update" : "Create Category"}
            </button>
          </div>
        </section>

        {/* Sub-categories panel */}
        <aside className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-6">
          {!isEdit ? (
            <div className="grid place-items-center gap-3 py-10 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-muted text-foreground/40">
                <Package className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-foreground/80">
                Save the category first
              </p>
              <p className="max-w-xs text-xs text-foreground/60">
                Create this category, then add sub-categories inline here.
              </p>
            </div>
          ) : (
            <SubCategoriesPanel
              parentId={node!.id}
              storeId={storeId}
              items={subCategories}
              query={subQuery}
              onQuery={setSubQuery}
              onOpenFull={(id) => navigate({ to: "/categories/$id/edit", params: { id } })}
              onDelete={deleteSub}
              removePending={remove.isPending}
            />
          )}
        </aside>
      </div>
    </main>
  );
}

function SubCategoriesPanel({
  parentId, storeId, items, query, onQuery, onOpenFull, onDelete, removePending,
}: {
  parentId: string;
  storeId: string;
  items: CategoryRow[];
  query: string;
  onQuery: (v: string) => void;
  onOpenFull: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  removePending: boolean;
}) {
  const create = useCreateCategory(storeId);
  const update = useUpdateCategory(storeId);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function addInline() {
    const n = newName.trim();
    if (!n) return;
    setErr(null);
    try {
      await create.mutateAsync({ name: n, parent_id: parentId });
      setNewName("");
    } catch (e) {
      setErr((e as Error)?.message ?? "Could not add.");
    }
  }

  function startEdit(c: CategoryRow) {
    setEditingId(c.id);
    setEditingName(c.name);
    setErr(null);
  }

  async function saveEdit() {
    if (!editingId) return;
    const n = editingName.trim();
    if (!n) return;
    try {
      await update.mutateAsync({ id: editingId, name: n });
      setEditingId(null);
    } catch (e) {
      setErr((e as Error)?.message ?? "Could not save.");
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <h3 className="mr-auto font-display text-sm font-black uppercase tracking-wide text-foreground/70">
          Sub Categories ({items.length})
        </h3>
      </div>

      {/* Inline add row */}
      <div className="mt-3 flex items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value.slice(0, 50))}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); void addInline(); }
          }}
          placeholder="New sub category name"
          className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none ring-primary/30 focus:ring-2"
        />
        <button
          type="button"
          onClick={addInline}
          disabled={!newName.trim() || create.isPending}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl gradient-primary px-3 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
      </div>

      {items.length > 0 && (
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search sub categories"
            className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none ring-primary/30 focus:ring-2"
          />
        </div>
      )}

      {err && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600">
          <AlertCircle className="h-3.5 w-3.5" /> {err}
        </p>
      )}

      {items.length === 0 ? (
        <div className="mt-6 grid place-items-center gap-2 rounded-xl border border-dashed border-border py-8 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-foreground/40">
            <Package className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-foreground/80">
            Your sub categories list is currently empty
          </p>
          <p className="max-w-xs text-xs text-foreground/60">
            Type a name above and click Add to create your first one.
          </p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((c) => {
            const isEditing = editingId === c.id;
            return (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-xl border border-border p-2 hover:bg-muted/40"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted">
                  {c.image_url ? (
                    <img src={c.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-foreground/40" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value.slice(0, 50))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); void saveEdit(); }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                      className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none ring-primary/30 focus:ring-2"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenFull(c.id)}
                      className="block w-full truncate text-left text-sm font-semibold hover:text-primary"
                      title="Open full editor"
                    >
                      {c.name}
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={update.isPending || !editingName.trim()}
                      className="grid h-8 w-8 place-items-center rounded-md text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                      aria-label="Save"
                    >
                      {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="grid h-8 w-8 place-items-center rounded-md text-foreground/60 hover:bg-foreground/5"
                      aria-label="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="grid h-8 w-8 place-items-center rounded-md text-foreground/60 hover:bg-primary/10 hover:text-primary"
                      aria-label="Rename"
                      title="Rename inline"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(c.id, c.name)}
                      disabled={removePending}
                      className="grid h-8 w-8 place-items-center rounded-md text-red-500 hover:bg-red-50 disabled:opacity-50"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

