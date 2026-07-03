import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StoreRow } from "@/lib/eazystore-data";

/**
 * Returns true when the storefront should show the "Developed by EazyShop"
 * badge — i.e. the store owner is on the free plan AND is NOT a super_admin.
 */
export function useShowDevelopedBadge(store: Pick<StoreRow, "plan_tier" | "owner_user_id"> | null | undefined) {
  const isFree = !store?.plan_tier || store.plan_tier === "free";
  const q = useQuery({
    queryKey: ["owner-is-super-admin", store?.owner_user_id],
    enabled: !!store?.owner_user_id && isFree,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: store!.owner_user_id,
        _role: "super_admin",
      });
      if (error) return false;
      return !!data;
    },
  });
  if (!isFree) return false;
  // While loading, default to showing the badge — safer for free stores.
  return !q.data;
}

export function DevelopedByBadge({ className = "" }: { className?: string }) {
  return (
    <p className={`text-center text-xs text-neutral-500 ${className}`}>
      Developed by{" "}
      <a
        href="https://eazystorebd.lovable.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-neutral-700 hover:underline"
      >
        EazyShop
      </a>
    </p>
  );
}
