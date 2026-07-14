// Server-only helper to poll dropshipper source URLs and mark products
// out-of-stock on our platform when the source is out-of-stock.
// Includes:
//  • Automatic retries with exponential backoff
//  • Per-domain rate limiting (min interval between hits)
//  • Audit logging to public.product_stock_sync_logs
//  • Store-owner notifications on availability flips
// Used by cron (/api/public/hooks/resync-source-stock) and manual
// "Resync now" server functions.

export type Availability = "in_stock" | "out_of_stock" | "unknown";

async function fetchHtmlOnce(
  url: string,
  timeoutMs = 12_000,
): Promise<{ ok: boolean; status: number; html: string | null; error: string | null }> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; EasyStoreBot/1.0; +https://easystorebd.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, status: res.status, html: null, error: `HTTP ${res.status}` };
    const html = await res.text();
    return { ok: true, status: res.status, html, error: null };
  } catch (e) {
    return { ok: false, status: 0, html: null, error: (e as Error).message ?? "fetch failed" };
  } finally {
    clearTimeout(t);
  }
}

// ─── Per-domain rate limiter ───────────────────────────────────────────────
const MIN_DOMAIN_INTERVAL_MS = 1_200;
const lastHitAt = new Map<string, number>();

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "unknown";
  }
}

async function waitForDomainSlot(url: string) {
  const host = domainOf(url);
  const now = Date.now();
  const last = lastHitAt.get(host) ?? 0;
  const wait = last + MIN_DOMAIN_INTERVAL_MS - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHitAt.set(host, Date.now());
}

// ─── Retry with exponential backoff ─────────────────────────────────────────
export type FetchOutcome = {
  status: number;
  html: string | null;
  error: string | null;
  attempts: number;
  durationMs: number;
};

async function fetchWithRetries(url: string, maxAttempts = 3): Promise<FetchOutcome> {
  const started = Date.now();
  let attempt = 0;
  let last: { status: number; html: string | null; error: string | null } = {
    status: 0,
    html: null,
    error: "not attempted",
  };
  while (attempt < maxAttempts) {
    attempt++;
    await waitForDomainSlot(url);
    const r = await fetchHtmlOnce(url);
    last = { status: r.status, html: r.html, error: r.error };
    if (r.ok) break;
    // 4xx (except 408/429) → no retry
    if (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429) break;
    if (attempt < maxAttempts) {
      const backoff = 500 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250);
      await new Promise((res) => setTimeout(res, backoff));
    }
  }
  return { ...last, attempts: attempt, durationMs: Date.now() - started };
}

// ─── Availability detection ─────────────────────────────────────────────────
export function detectAvailability(html: string): Availability {
  const ldRe =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  const nodes: any[] = [];
  while ((m = ldRe.exec(html))) {
    try {
      const p = JSON.parse(m[1].trim());
      if (Array.isArray(p)) nodes.push(...p);
      else nodes.push(p);
    } catch { /* ignore */ }
  }
  const flat: any[] = [];
  for (const n of nodes) {
    if (n && Array.isArray(n["@graph"])) flat.push(...n["@graph"]);
    else flat.push(n);
  }
  for (const n of flat) {
    const t = n?.["@type"];
    const isProduct = t === "Product" || (Array.isArray(t) && t.includes("Product"));
    if (!isProduct) continue;
    const offers = n.offers;
    const arr = Array.isArray(offers) ? offers : offers ? [offers] : [];
    for (const o of arr) {
      const a = String(o?.availability ?? "").toLowerCase();
      if (a.includes("outofstock") || a.includes("soldout")) return "out_of_stock";
      if (a.includes("instock") || a.includes("preorder") || a.includes("backorder"))
        return "in_stock";
    }
  }
  const metaAvail = html.match(
    /<meta[^>]+property=["'](?:product|og):availability["'][^>]+content=["']([^"']+)["']/i,
  );
  if (metaAvail?.[1]) {
    const a = metaAvail[1].toLowerCase();
    if (a.includes("out")) return "out_of_stock";
    if (a.includes("in")) return "in_stock";
  }
  const text = html.replace(/<[^>]+>/g, " ").toLowerCase();
  if (/\bout\s*of\s*stock\b|\bsold\s*out\b|স্টক\s*শেষ|স্টক\s*নেই/i.test(text))
    return "out_of_stock";
  return "unknown";
}

// ─── Notifications ──────────────────────────────────────────────────────────
async function notifyOwnerOfStockFlip(
  admin: any,
  product: { id: string; store_id: string | null; name: string | null },
  from: "in_stock" | "out_of_stock",
  to: "in_stock" | "out_of_stock",
) {
  if (!product.store_id) return;
  const { data: store } = await admin
    .from("stores")
    .select("owner_user_id, slug")
    .eq("id", product.store_id)
    .maybeSingle();
  const ownerId = (store as any)?.owner_user_id as string | undefined;
  if (!ownerId) return;
  const title =
    to === "out_of_stock"
      ? `Product went out of stock: ${product.name ?? "Product"}`
      : `Product back in stock: ${product.name ?? "Product"}`;
  const body =
    to === "out_of_stock"
      ? "Source dropshipper reports this item is out of stock. We paused it on your store."
      : "Source dropshipper reports this item is available again. It has been re-enabled.";
  await admin.from("user_notifications").insert({
    user_id: ownerId,
    type: to === "out_of_stock" ? "stock_out" : "stock_in",
    title,
    body,
    link: `/products?product=${product.id}`,
    related_id: product.id,
  });
}

// ─── Per-product sync ───────────────────────────────────────────────────────
export type PerProductResult = {
  product_id: string;
  availability: Availability;
  changed: boolean;
  previous_status: "in_stock" | "out_of_stock";
  new_status: "in_stock" | "out_of_stock";
  error: string | null;
};

export async function syncOneProduct(
  admin: any,
  product: {
    id: string;
    store_id: string | null;
    name: string | null;
    stock: number | null;
    is_out_of_stock: boolean | null;
    source_product_url: string | null;
  },
  triggeredBy: "cron" | "manual" | "manual_store" = "cron",
): Promise<PerProductResult> {
  const url = product.source_product_url ?? "";
  const prev = product.is_out_of_stock ? "out_of_stock" : "in_stock";
  if (!url) {
    return {
      product_id: product.id,
      availability: "unknown",
      changed: false,
      previous_status: prev,
      new_status: prev,
      error: "no source_product_url",
    };
  }

  const fetched = await fetchWithRetries(url);
  const availability: Availability = fetched.html
    ? detectAvailability(fetched.html)
    : "unknown";

  let next: "in_stock" | "out_of_stock" = prev;
  let changed = false;
  let updateErr: string | null = null;

  if (availability === "out_of_stock" && !product.is_out_of_stock) {
    const { error } = await admin
      .from("products")
      .update({ is_out_of_stock: true, stock: 0 })
      .eq("id", product.id);
    if (error) updateErr = error.message;
    else {
      next = "out_of_stock";
      changed = true;
    }
  } else if (availability === "in_stock" && product.is_out_of_stock) {
    const { error } = await admin
      .from("products")
      .update({ is_out_of_stock: false })
      .eq("id", product.id);
    if (error) updateErr = error.message;
    else {
      next = "in_stock";
      changed = true;
    }
  }

  // Log the attempt
  await admin.from("product_stock_sync_logs").insert({
    product_id: product.id,
    store_id: product.store_id,
    source_url: url,
    http_status: fetched.status || null,
    duration_ms: fetched.durationMs,
    attempts: fetched.attempts,
    availability,
    previous_status: prev,
    new_status: next,
    changed,
    error_message: updateErr ?? fetched.error,
    triggered_by: triggeredBy,
  });

  if (changed) {
    try {
      await notifyOwnerOfStockFlip(admin, product, prev, next);
    } catch (e) {
      console.error("[stock-sync] notification failed", e);
    }
  }

  return {
    product_id: product.id,
    availability,
    changed,
    previous_status: prev,
    new_status: next,
    error: updateErr ?? fetched.error,
  };
}

// ─── Bulk sync (cron) ───────────────────────────────────────────────────────
export type ResyncResult = {
  scanned: number;
  markedOutOfStock: number;
  restocked: number;
  unchanged: number;
  failed: number;
};

export async function resyncSourceStockForAllProducts(
  admin: any,
  opts: { limit?: number; storeId?: string | null; triggeredBy?: "cron" | "manual" | "manual_store" } = {},
): Promise<ResyncResult> {
  const limit = opts.limit ?? 500;
  const triggeredBy = opts.triggeredBy ?? "cron";
  let q = admin
    .from("products")
    .select("id, store_id, name, stock, is_out_of_stock, source_product_url")
    .not("source_product_url", "is", null)
    .neq("source_product_url", "")
    .limit(limit);
  if (opts.storeId) q = q.eq("store_id", opts.storeId);
  const { data: rows, error } = await q;
  if (error) throw error;

  const res: ResyncResult = {
    scanned: 0,
    markedOutOfStock: 0,
    restocked: 0,
    unchanged: 0,
    failed: 0,
  };

  for (const p of (rows ?? []) as any[]) {
    res.scanned++;
    const r = await syncOneProduct(admin, p, triggeredBy);
    if (r.availability === "unknown") res.failed++;
    else if (r.changed && r.new_status === "out_of_stock") res.markedOutOfStock++;
    else if (r.changed && r.new_status === "in_stock") res.restocked++;
    else res.unchanged++;
  }
  return res;
}

// Legacy helper retained for callers that only want the availability check.
export async function checkSourceAvailability(url: string): Promise<Availability> {
  const r = await fetchWithRetries(url, 2);
  if (!r.html) return "unknown";
  return detectAvailability(r.html);
}
