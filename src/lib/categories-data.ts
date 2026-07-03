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
    mutationFn: async (input: { name: string; parent_id: string | null }) => {
      if (!storeId) throw new Error("No store");
      const name = input.name.trim();
      if (name.length < 1) throw new Error("Name is required.");
      const { error } = await supabase.from("product_categories").insert({
        store_id: storeId,
        parent_id: input.parent_id,
        name,
        slug: slugify(name) || null,
      });
      if (error) {
        if (error.code === "23505") throw new Error("A category with this name already exists here.");
        throw error;
      }
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
