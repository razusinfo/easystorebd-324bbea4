import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseLowStockThreshold, validateLowStockThreshold } from "./admin-settings-core";

/** Read the current Low Stock Threshold from site_settings (public). */
export const getLowStockThresholdSetting = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("site_settings")
      .select("low_stock_threshold")
      .eq("id", "global")
      .maybeSingle();
    if (error) throw error;
    return { value: parseLowStockThreshold((data as any)?.low_stock_threshold) };
  });

/** Update the Low Stock Threshold. Super-admin only (enforced by RLS on site_settings). */
export const updateLowStockThresholdSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { value: number }) => ({ value: validateLowStockThreshold(d.value) }))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("site_settings")
      .update({ low_stock_threshold: data.value, updated_by: context.userId })
      .eq("id", "global");
    if (error) throw error;
    return { value: data.value };
  });

/**
 * Super-admin: revoke a marketplace product. Cascades:
 *  - unlists all reseller copies (products.status -> 'rejected')
 *  - notifies each affected reseller
 *  - writes an audit-log entry
 *  - deletes the reseller_products row
 */
export const revokeResellerProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; reason?: string }) => ({
    id: String(d.id),
    reason: d.reason ? String(d.reason).slice(0, 500) : undefined,
  }))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("admin_revoke_reseller_product", {
      _reseller_product_id: data.id,
      _reason: data.reason ?? null,
    } as any);
    if (error) throw error;
    return { ok: true };
  });
