import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LOVABLE_IP = "185.158.133.1";

function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");
}

function isValidDomain(d: string): boolean {
  return /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d);
}

function genToken(): string {
  return "lov_" + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

export type DomainStatus =
  | "pending" | "verifying" | "dns_ok" | "ssl_pending" | "live" | "failed" | "offline";

export type CustomDomainRow = {
  id: string;
  store_id: string;
  owner_id: string;
  domain: string;
  status: DomainStatus;
  verification_token: string;
  dns_target: string;
  ssl_issued_at: string | null;
  last_checked_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export const listMyCustomDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("custom_domains" as never)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as CustomDomainRow[];
  });

export const addCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { storeId: string; domain: string }) => d)
  .handler(async ({ data, context }) => {
    const domain = normalizeDomain(data.domain);
    if (!isValidDomain(domain)) throw new Error("Invalid domain format");

    const { data: store } = await context.supabase
      .from("stores")
      .select("id, owner_user_id")
      .eq("id", data.storeId)
      .maybeSingle();
    if (!store || store.owner_user_id !== context.userId) {
      throw new Error("Store not found or access denied");
    }

    const sb = context.supabase as unknown as { from: (t: string) => any };
    const { data: inserted, error } = await sb
      .from("custom_domains")
      .insert({
        store_id: data.storeId,
        owner_id: context.userId,
        domain,
        verification_token: genToken(),
        dns_target: LOVABLE_IP,
        status: "pending",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return inserted as CustomDomainRow;
  });

export const removeCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("custom_domains" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function resolveA(hostname: string): Promise<string[]> {
  try {
    const dns = await import("dns");
    const addrs = await dns.promises.resolve4(hostname);
    return addrs;
  } catch {
    return [];
  }
}

export async function probeHttps(
  hostname: string,
  opts?: { fetchImpl?: typeof fetch },
): Promise<{
  ok: boolean;
  status?: number;
  servedByApp?: boolean;
  error?: string;
  finalUrl?: string;
  redirectChain?: string[];
  cloudflareError?: number; // 1000 = "DNS points to prohibited IP"
}> {
  const doFetch = opts?.fetchImpl ?? fetch;
  const redirectChain: string[] = [];
  let currentUrl = `https://${hostname}/`;
  try {
    for (let hop = 0; hop < 5; hop++) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);
      const res = await doFetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "EasyStore-DomainProbe/1.0" },
      });
      clearTimeout(t);
      redirectChain.push(`${res.status} ${currentUrl}`);

      // Follow 3xx redirects manually so we can validate the final Host header.
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return { ok: false, status: res.status, servedByApp: false, redirectChain };
        currentUrl = new URL(loc, currentUrl).toString();
        continue;
      }

      let body = "";
      try { body = (await res.text()).slice(0, 16000); } catch { /* ignore */ }

      // Cloudflare Error 1000 = proxied A record points at another Cloudflare
      // IP (Lovable's edge is also on Cloudflare). Fix: grey-cloud the record.
      if (/error\s*1000/i.test(body) || /DNS points to prohibited IP/i.test(body)) {
        return {
          ok: false, status: res.status, servedByApp: false,
          cloudflareError: 1000, finalUrl: currentUrl, redirectChain,
        };
      }

      if (res.status >= 400) {
        return { ok: false, status: res.status, servedByApp: false, finalUrl: currentUrl, redirectChain };
      }

      const servedByApp = /EasyStore|id="root"|data-lovable/i.test(body);
      return { ok: servedByApp, status: res.status, servedByApp, finalUrl: currentUrl, redirectChain };
    }
    return { ok: false, error: "Too many redirects", redirectChain };
  } catch (e) {
    return { ok: false, error: (e as Error).message, redirectChain };
  }
}

export const checkDomainStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("custom_domains" as never)
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Domain not found");
    const domain = (row as CustomDomainRow).domain;
    const target = (row as CustomDomainRow).dns_target || LOVABLE_IP;

    const addrs = await resolveA(domain);
    const dnsOk = addrs.includes(target);
    let status: DomainStatus = "verifying";
    let error: string | null = null;
    let sslIssuedAt: string | null = (row as CustomDomainRow).ssl_issued_at;

    if (!dnsOk) {
      status = addrs.length === 0 ? "verifying" : "failed";
      if (addrs.length > 0) error = `DNS points to ${addrs.join(", ")} instead of ${target}`;
    } else {
      const probe = await probeHttps(domain);
      if (probe.ok) {
        status = "live";
        if (!sslIssuedAt) sslIssuedAt = new Date().toISOString();
      } else {
        status = "ssl_pending";
        error = probe.error ?? null;
      }
    }

    const sb2 = context.supabase as unknown as { from: (t: string) => any };
    const { data: updated, error: upErr } = await sb2
      .from("custom_domains")
      .update({
        status,
        last_checked_at: new Date().toISOString(),
        last_error: error,
        ssl_issued_at: sslIssuedAt,
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (upErr) throw new Error(upErr.message);
    return updated as CustomDomainRow;
  });

// Platform (super admin) setup
export type PlatformSetup = {
  id: number;
  cloudflare_added: boolean;
  nameservers_updated: boolean;
  dns_records_added: boolean;
  ssl_mode_set: boolean;
  lovable_wildcard_connected: boolean;
  current_step: number;
  notes: string | null;
  updated_at: string;
};

export const getPlatformSetup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!role) throw new Error("Forbidden");
    const { data, error } = await context.supabase
      .from("platform_domain_setup" as never)
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data ?? null) as PlatformSetup | null;
  });

export const updatePlatformSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Partial<Omit<PlatformSetup, "id" | "updated_at">>) => d)
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!role) throw new Error("Forbidden");
    const sb3 = context.supabase as unknown as { from: (t: string) => any };
    const { data: updated, error } = await sb3
      .from("platform_domain_setup")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", 1)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return updated as PlatformSetup;
  });

export const verifyWildcardConnected = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!role) throw new Error("Forbidden");
    // Probe a random subdomain that shouldn't exist as a store — it should still
    // resolve to Lovable's IP if wildcard is set up, and HTTPS should respond.
    const testHost = `verify-${Date.now().toString(36)}.easystorebd.com`;
    const addrs = await resolveA(testHost);
    const dnsOk = addrs.includes(LOVABLE_IP);
    let httpsOk = false;
    let httpStatus: number | undefined;
    let servedByApp: boolean | undefined;
    let finalUrl: string | undefined;
    let redirectChain: string[] | undefined;
    let cloudflareError: number | undefined;
    let hint: string | null = null;
    if (dnsOk) {
      const probe = await probeHttps(testHost);
      httpsOk = probe.ok;
      httpStatus = probe.status;
      servedByApp = probe.servedByApp;
      finalUrl = probe.finalUrl;
      redirectChain = probe.redirectChain;
      cloudflareError = probe.cloudflareError;
      if (!probe.ok) hint = buildProbeHint(probe);
    } else if (addrs.length === 0) {
      hint = "DNS এখনো propagate হয়নি — ২৪–৪৮ ঘণ্টা পর্যন্ত সময় নিতে পারে।";
    } else {
      hint = `DNS ${addrs.join(", ")}-এ point করছে, ${LOVABLE_IP} নয়। Cloudflare-এ A record ঠিক করুন।`;
    }
    return { dnsOk, httpsOk, testHost, addrs, httpStatus, servedByApp, finalUrl, redirectChain, cloudflareError, hint };
  });

/** Pure hint builder — exported for unit tests. */
export function buildProbeHint(probe: {
  ok: boolean;
  status?: number;
  cloudflareError?: number;
  error?: string;
}): string | null {
  if (probe.ok) return null;
  if (probe.cloudflareError === 1000) {
    return (
      "Cloudflare Error 1000: DNS points to prohibited IP। আপনার wildcard A record " +
      "(`*` → 185.158.133.1) Cloudflare-এ 🟠 Proxied অবস্থায় আছে, কিন্তু Lovable-এর edge নিজেই " +
      "Cloudflare-এ চলে — এতে proxy loop হচ্ছে। ঠিক করার উপায়: Cloudflare → DNS → Records-এ " +
      "`*` A record খুঁজে **Proxy status: DNS only (☁️ grey cloud)** করুন। `@` ও `www` record " +
      "Proxied রাখতে পারেন। ৫–১০ মিনিট পর আবার Verify করুন।"
    );
  }
  if (probe.status === 403 || probe.status === 404) {
    return (
      `DNS ঠিক আছে কিন্তু Lovable hosting এই subdomain accept করছে না (HTTP ${probe.status})। ` +
      "Cloudflare wildcard একা যথেষ্ট নয় — Lovable side-এ wildcard enable করতে হবে: " +
      "Project Settings → Domains → Connect domain দিয়ে `easystorebd.com` attach করুন " +
      "(Advanced → “Domain uses Cloudflare or a similar proxy” টিক দিয়ে), অথবা Enterprise " +
      "plan-এ Lovable support-কে `*.easystorebd.com` wildcard enable করতে বলুন।"
    );
  }
  if (probe.status && probe.status >= 500) {
    return `Lovable hosting ${probe.status} response দিচ্ছে — কিছুক্ষণ পর আবার চেষ্টা করুন।`;
  }
  if (!probe.status) return probe.error ?? "HTTPS response পাওয়া যায়নি।";
  return null;
}

