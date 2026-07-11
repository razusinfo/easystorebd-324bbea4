import { createServerFn } from "@tanstack/react-start";
import type { TenantResult } from "./tenant-resolver.server";

export type { TenantResult, TenantStore } from "./tenant-resolver.server";

export const resolveTenant = createServerFn({ method: "GET" }).handler(
  async (): Promise<TenantResult> => {
    const { getRequestHost } = await import("@tanstack/react-start/server");
    const { resolveTenantServer } = await import("./tenant-resolver.server");
    let host: string | null = null;
    try {
      host = getRequestHost();
    } catch {
      host = null;
    }
    return resolveTenantServer(host);
  },
);

export const listPublicStores = createServerFn({ method: "GET" }).handler(
  async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        },
      },
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
