import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Public: log an OAuth failure from the browser. Anyone can write (RLS allows insert-only).
export const logOAuthError = createServerFn({ method: "POST" })
  .inputValidator((input: {
    provider?: string; host?: string; tenant_slug?: string | null;
    redirect_uri?: string; message?: string; status_hint?: string | null;
    user_agent?: string; path?: string;
  }) => input)
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Server-side detailed log for quick grep in function logs.
    console.warn(
      `[oauth-error] provider=${data.provider ?? "google"} host=${data.host ?? "-"} ` +
      `slug=${data.tenant_slug ?? "-"} redirect_uri=${data.redirect_uri ?? "-"} ` +
      `msg=${(data.message ?? "").slice(0, 240)}`,
    );
    await sb.from("oauth_error_logs").insert({
      provider: data.provider ?? "google",
      host: data.host ?? null,
      tenant_slug: data.tenant_slug ?? null,
      redirect_uri: data.redirect_uri ?? null,
      message: (data.message ?? "").slice(0, 1000),
      status_hint: data.status_hint ?? null,
      user_agent: (data.user_agent ?? "").slice(0, 500),
      path: data.path ?? null,
    });
    return { ok: true };
  });

// Admin: recent OAuth errors + custom-domain status + subdomain audit hits.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertSuperAdmin(context: any) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId, _role: "super_admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

export const listOAuthTroubleshoot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [errs, domains, audit] = await Promise.all([
      supabaseAdmin.from("oauth_error_logs")
        .select("id, created_at, provider, host, tenant_slug, redirect_uri, message, status_hint, path")
        .order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("custom_domains")
        .select("domain, status, store_id, created_at").order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("tenant_resolver_audit")
        .select("host, kind, attempted, hit_count, last_seen")
        .in("kind", ["unknown-sub", "unknown-custom"])
        .order("last_seen", { ascending: false }).limit(50),
    ]);
    return {
      errors: errs.data ?? [],
      domains: domains.data ?? [],
      audit: audit.data ?? [],
    };
  });
