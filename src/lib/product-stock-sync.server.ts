// Server-only helper to poll dropshipper source URLs and mark products
// out-of-stock on our platform when the source is out-of-stock.
// Used by the periodic cron hook at /api/public/hooks/resync-source-stock.

type Availability = "in_stock" | "out_of_stock" | "unknown";

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; EasyStoreBot/1.0; +https://easystorebd.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function detectAvailability(html: string): Availability {
  // JSON-LD availability
  const ldRe =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  const nodes: any[] = [];
  while ((m = ldRe.exec(html))) {
    try {
      const p = JSON.parse(m[1].trim());
      if (Array.isArray(p)) nodes.push(...p);
      else nodes.push(p);
    } catch {
      /* ignore */
    }
  }
  const flat: any[] = [];
  for (const n of nodes) {
    if (n && Array.isArray(n["@graph"])) flat.push(...n["@graph"]);
    else flat.push(n);
  }
  for (const n of flat) {
    const t = n?.["@type"];
    const isProduct =
      t === "Product" || (Array.isArray(t) && t.includes("Product"));
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
  // OG / meta signals
  const metaAvail = html.match(
    /<meta[^>]+property=["'](?:product|og):availability["'][^>]+content=["']([^"']+)["']/i,
  );
  if (metaAvail?.[1]) {
    const a = metaAvail[1].toLowerCase();
    if (a.includes("out")) return "out_of_stock";
    if (a.includes("in")) return "in_stock";
  }
  // Textual fallback
  const text = html.replace(/<[^>]+>/g, " ").toLowerCase();
  if (/\bout\s*of\s*stock\b|\bsold\s*out\b|স্টক\s*শেষ|স্টক\s*নেই/i.test(text))
    return "out_of_stock";
  return "unknown";
}

export async function checkSourceAvailability(
  url: string,
): Promise<Availability> {
  const html = await fetchHtml(url);
  if (!html) return "unknown";
  return detectAvailability(html);
}

export type ResyncResult = {
  scanned: number;
  markedOutOfStock: number;
  restocked: number;
  unchanged: number;
  failed: number;
};

export async function resyncSourceStockForAllProducts(
  admin: any,
  opts: { limit?: number } = {},
): Promise<ResyncResult> {
  const limit = opts.limit ?? 500;
  const { data: rows, error } = await admin
    .from("products")
    .select("id, stock, is_out_of_stock, source_product_url")
    .not("source_product_url", "is", null)
    .neq("source_product_url", "")
    .limit(limit);
  if (error) throw error;

  const res: ResyncResult = {
    scanned: 0,
    markedOutOfStock: 0,
    restocked: 0,
    unchanged: 0,
    failed: 0,
  };

  for (const p of rows ?? []) {
    res.scanned++;
    const avail = await checkSourceAvailability(p.source_product_url as string);
    if (avail === "unknown") {
      res.failed++;
      continue;
    }
    if (avail === "out_of_stock" && !p.is_out_of_stock) {
      const { error: uerr } = await admin
        .from("products")
        .update({ is_out_of_stock: true, stock: 0 })
        .eq("id", p.id);
      if (uerr) res.failed++;
      else res.markedOutOfStock++;
    } else if (avail === "in_stock" && p.is_out_of_stock) {
      // Only clear the flag; don't fabricate stock quantity.
      const { error: uerr } = await admin
        .from("products")
        .update({ is_out_of_stock: false })
        .eq("id", p.id);
      if (uerr) res.failed++;
      else res.restocked++;
    } else {
      res.unchanged++;
    }
  }
  return res;
}
