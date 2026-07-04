import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Sync a product to the external reseller marketplace SaaS.
// Reads endpoint URL + optional bearer key from server-only env vars:
//   RESELLER_SYNC_URL       — full URL to POST to (e.g. https://saas.example.com/api/products/sync)
//   RESELLER_SYNC_API_KEY   — optional bearer token
// If RESELLER_SYNC_URL is not set, the call is a no-op (returns { skipped: true }).
export const syncResellerProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable().optional(),
      image: z.string().nullable().optional(),
      price: z.number(),
      reseller_price: z.number().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const heldRoles = (roles ?? []).map((r: { role: string }) => r.role);
    const isAdmin = heldRoles.includes("super_admin");
    const actorRole = isAdmin ? "super_admin" : (heldRoles[0] ?? "unknown");

    const logAttempt = async (success: boolean, error?: string) => {
      await supabaseAdmin.from("reseller_marketplace_audit_logs").insert({
        actor_id: context.userId,
        actor_role: actorRole,
        action: "sync_reseller_product_external",
        product_id: data.id,
        success,
        error: error ?? null,
      });
    };

    if (!isAdmin) {
      await logAttempt(false, "forbidden");
      throw new Response("Forbidden: super_admin only", { status: 403 });
    }

    const url = process.env.RESELLER_SYNC_URL;
    if (!url) {
      console.warn("[reseller-sync] RESELLER_SYNC_URL not configured — skipping");
      await logAttempt(true, "skipped: no url configured");
      return { skipped: true as const };
    }
    const apiKey = process.env.RESELLER_SYNC_API_KEY;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const msg = `Reseller sync failed: ${res.status} ${text}`.trim();
      await logAttempt(false, msg);
      throw new Error(msg);
    }
    await logAttempt(true);
    return { ok: true as const, status: res.status };
  });
