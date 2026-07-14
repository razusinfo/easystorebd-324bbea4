import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2, Pencil, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MarketplaceAdminShell } from "@/components/marketplace-admin/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useMarketplaceCategories,
  useUpsertCategory,
  useToggleCategoryHidden,
  useDeleteCategory,
  type MarketplaceCategoryRow,
} from "@/lib/marketplace-admin";

export const Route = createFileRoute("/_authenticated/admin-marketplace/categories")({
  head: () => ({ meta: [{ title: "Categories & Menu — EasyStore365 Control" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (!(r ?? []).some((x) => x.role === "super_admin")) throw redirect({ to: "/dashboard" });
  },
  component: CategoriesPage,
});

function CategoriesPage() {
  const list = useMarketplaceCategories();
  const toggle = useToggleCategoryHidden();
  const del = useDeleteCategory();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MarketplaceCategoryRow | null>(null);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    (list.data ?? []).forEach((c) => m.set(c.id, c.name));
    return m;
  }, [list.data]);

  return (
    <MarketplaceAdminShell
      currentPath="/admin-marketplace/categories"
      title="Category & Menu Settings"
      description="Add, edit, hide or delete marketplace categories. Changes reflect instantly in the mega menu on EasyStore365.com."
      actions={
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gradient-primary text-primary-foreground">
          <Plus className="mr-1.5 h-4 w-4" /> New Category
        </Button>
      }
    >
      {list.isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (list.data ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card py-16 text-center text-sm text-muted-foreground">
          No categories yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="divide-y">
            {list.data!.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3">
                {c.image_url ? (
                  <img src={c.image_url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={"truncate font-semibold " + (c.is_hidden ? "text-muted-foreground line-through" : "")}>
                      {c.name}
                    </span>
                    {c.parent_id && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        under {nameById.get(c.parent_id) ?? "…"}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">/{c.slug}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    {c.is_hidden ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-primary" />}
                    <Switch
                      checked={!c.is_hidden}
                      onCheckedChange={(v) => toggle.mutate({ id: c.id, is_hidden: !v })}
                    />
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setEditing(c); setOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => { if (confirm(`Delete "${c.name}"?`)) del.mutate(c.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <CategoryDialog open={open} setOpen={setOpen} editing={editing} all={list.data ?? []} />
    </MarketplaceAdminShell>
  );
}

function CategoryDialog({
  open, setOpen, editing, all,
}: { open: boolean; setOpen: (v: boolean) => void; editing: MarketplaceCategoryRow | null; all: MarketplaceCategoryRow[] }) {
  const upsert = useUpsertCategory();
  const [name, setName] = useState(editing?.name ?? "");
  const [parentId, setParentId] = useState<string>(editing?.parent_id ?? "");
  const [imageUrl, setImageUrl] = useState<string>(editing?.image_url ?? "");
  const [sortOrder, setSortOrder] = useState<number>(editing?.sort_order ?? 0);
  const [isHidden, setIsHidden] = useState(editing?.is_hidden ?? false);

  // Reset on open
  useState(() => {
    setName(editing?.name ?? "");
    setParentId(editing?.parent_id ?? "");
    setImageUrl(editing?.image_url ?? "");
    setSortOrder(editing?.sort_order ?? 0);
    setIsHidden(editing?.is_hidden ?? false);
  });

  function save() {
    if (!name.trim()) return toast.error("Name required");
    upsert.mutate(
      {
        id: editing?.id,
        name: name.trim(),
        parent_id: parentId || null,
        image_url: imageUrl || null,
        sort_order: Number(sortOrder) || 0,
        is_hidden: isHidden,
      },
      {
        onSuccess: () => { toast.success("Saved"); setOpen(false); },
        onError: (e: any) => toast.error(e.message || "Failed"),
      },
    );
  }

  const parentOptions = all.filter((c) => c.id !== editing?.id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Edit Category" : "New Category"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Electronics" />
          </div>
          <div>
            <Label>Parent</Label>
            <Select value={parentId || "__none__"} onValueChange={(v) => setParentId(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Top-level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Top level —</SelectItem>
                {parentOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sort order</Label>
              <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
            </div>
            <div>
              <Label>Image URL</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-semibold">Hidden</div>
              <div className="text-xs text-muted-foreground">Hides it from the marketplace mega menu.</div>
            </div>
            <Switch checked={isHidden} onCheckedChange={setIsHidden} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={upsert.isPending} className="gradient-primary text-primary-foreground">
            {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
