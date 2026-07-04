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
    const { data: isAdmin, error: roleErr } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });
    const url = process.env.RESELLER_SYNC_URL;
    if (!url) {
      console.warn("[reseller-sync] RESELLER_SYNC_URL not configured — skipping");
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
      throw new Error(`Reseller sync failed: ${res.status} ${text}`.trim());
    }
    return { ok: true as const, status: res.status };
  });
