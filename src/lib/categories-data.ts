// Product categories (nested tree) — owned by stores, RLS-scoped.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CategoryRow = {
  id: string;
  store_id: string;
  parent_id: string | null;
  name: string;
  slug: string | null;
  sort_order: number;
  image_url: string | null;
  banner_url: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};


export type CategoryNode = CategoryRow & { children: CategoryNode[] };

export function buildCategoryTree(rows: CategoryRow[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>();
  rows.forEach((r) => byId.set(r.id, { ...r, children: [] }));
  const roots: CategoryNode[] = [];
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortRec = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

export function useCategories(storeId: string | undefined) {
  return useQuery({
    queryKey: ["categories", "by-store", storeId],
    enabled: !!storeId,
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("*")
        .eq("store_id", storeId!)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
  });
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export function useCreateCategory(storeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      parent_id: string | null;
      image_url?: string | null;
      banner_url?: string | null;
      description?: string | null;
    }): Promise<CategoryRow> => {
      if (!storeId) throw new Error("No store");
      const name = input.name.trim();
      if (name.length < 1) throw new Error("Name is required.");
      const { data, error } = await supabase
        .from("product_categories")
        .insert({
          store_id: storeId,
          parent_id: input.parent_id,
          name,
          slug: slugify(name) || null,
          image_url: input.image_url ?? null,
          banner_url: input.banner_url ?? null,
          description: input.description ?? null,
        })
        .select("*")
        .single();
      if (error) {
        if (error.code === "23505") throw new Error("A category with this name already exists here.");
        throw error;
      }
      return data as CategoryRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories", "by-store", storeId] }),
  });
}

export function useRenameCategory(storeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const name = input.name.trim();
      if (name.length < 1) throw new Error("Name is required.");
      const { error } = await supabase
        .from("product_categories")
        .update({ name, slug: slugify(name) || null })
        .eq("id", input.id);
      if (error) {
        if (error.code === "23505") throw new Error("A sibling category already uses this name.");
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories", "by-store", storeId] }),
  });
}

export function useUpdateCategory(storeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      image_url?: string | null;
      banner_url?: string | null;
      description?: string | null;
    }) => {
      const patch: {
        name?: string;
        slug?: string | null;
        image_url?: string | null;
        banner_url?: string | null;
        description?: string | null;
      } = {};
      if (typeof input.name === "string") {
        const name = input.name.trim();
        if (!name) throw new Error("Name is required.");
        patch.name = name;
        patch.slug = slugify(name) || null;
      }
      if (input.image_url !== undefined) patch.image_url = input.image_url;
      if (input.banner_url !== undefined) patch.banner_url = input.banner_url;
      if (input.description !== undefined) patch.description = input.description;
      if (Object.keys(patch).length === 0) return;
      const { error } = await supabase.from("product_categories").update(patch).eq("id", input.id);
      if (error) {
        if (error.code === "23505") throw new Error("A sibling category already uses this name.");
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories", "by-store", storeId] }),
  });
}

export function useDeleteCategory(storeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories", "by-store", storeId] }),
  });
}

export async function uploadCategoryImage(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${user.id}/cat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("category-images")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (upErr) throw upErr;
  const { data: signed, error: signErr } = await supabase.storage
    .from("category-images")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Failed to sign image URL");
  return signed.signedUrl;
}


export function useReorderCategory(storeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; sort_order: number }) => {
      const { error } = await supabase
        .from("product_categories")
        .update({ sort_order: input.sort_order })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories", "by-store", storeId] }),
  });
}
