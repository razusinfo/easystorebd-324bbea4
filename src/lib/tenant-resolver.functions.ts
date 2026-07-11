import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TenantResult } from "./tenant-resolver.server";

export type { TenantResult, TenantStore } from "./tenant-resolver.server";

export type ResolvedTenant = {
  tenant: TenantResult;
  redirectUnknown: boolean;
  host: string | null;
};

export const resolveTenant = createServerFn({ method: "GET" }).handler(
  async (): Promise<ResolvedTenant> => {
    const { getRequestHost } = await import("@tanstack/react-start/server");
    const { resolveTenantServer, getUnknownTenantRedirect } = await import("./tenant-resolver.server");
    let host: string | null = null;
    try { host = getRequestHost(); } catch { host = null; }
    const [tenant, redirectUnknown] = await Promise.all([
      resolveTenantServer(host),
      getUnknownTenantRedirect(),
    ]);
    return { tenant, redirectUnknown, host };
  },
);

export const listPublicStores = createServerFn({ method: "GET" }).handler(
  async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data } = await sb
      .from("stores")
      .select("id, slug, name, logo_url, tagline")
      .eq("published", true)
      .not("slug", "is", null)
      .order("name", { ascending: true })
      .limit(200);
    return {
      stores: (data ?? []).filter(
        (s): s is { id: string; slug: string; name: string; logo_url: string | null; tagline: string | null } =>
          typeof s.slug === "string" && s.slug.length > 0,
      ),
    };
  },
);

// --- Super admin debug + admin actions ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertSuperAdmin(context: any) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId, _role: "super_admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

export const debugResolveTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { host: string }) => ({ host: String(input?.host ?? "").trim() }))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context as never);
    const { resolveTenantFresh } = await import("./tenant-resolver.server");
    const result = await resolveTenantFresh(data.host);
    return { input: data.host, result };
  });

export const listTenantAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context as never);
    const { data } = await (context as never as { supabase: ReturnType<typeof import("@supabase/supabase-js").createClient> })
      .supabase
      .from("tenant_resolver_audit")
      .select("host, kind, attempted, hit_count, first_seen, last_seen")
      .order("hit_count", { ascending: false })
      .limit(200);
    return { rows: (data ?? []) as Array<{
      host: string; kind: string; attempted: string | null;
      hit_count: number; first_seen: string; last_seen: string;
    }> };
  });

export const getUnknownRedirectSetting = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context as never);
    const { getUnknownTenantRedirect } = await import("./tenant-resolver.server");
    return { redirect: await getUnknownTenantRedirect() };
  });

export const setUnknownRedirectSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { redirect: boolean }) => ({ redirect: Boolean(input?.redirect) }))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("site_settings")
      .upsert({ id: "singleton", unknown_tenant_redirect: data.redirect, updated_at: new Date().toISOString() }, { onConflict: "id" });
    return { ok: true, redirect: data.redirect };
  });
