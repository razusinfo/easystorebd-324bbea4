import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Reseller/Supplier zone visibility.
 *
 * There is no dedicated "reseller" or "supplier" enum role — any authenticated
 * user who owns a store on the platform can list products (act as supplier) or
 * add other stores' products to their own storefront (act as reseller). Super
 * admins always see the zone.
 *
 * Returns { data: boolean, isLoading } so the sidebar can render a stable
 * placeholder while auth/role state is resolving instead of flashing links to
 * the wrong audience.
 */
export function useIsResellerOrSupplier() {
  return useQuery({
    queryKey: ["is-reseller-or-supplier"],
    queryFn: async (): Promise<boolean> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Super admin bypass
      const { data: adminRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();
      if (adminRow) return true;

      // Store owner? => can act as supplier/reseller
      const { count } = await supabase
        .from("stores")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", user.id);
      return (count ?? 0) > 0;
    },
    staleTime: 60_000,
  });
}
