import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ScrapedProduct = {
  name: string;
  description: string;
  price: number | null;
  regularPrice: number | null;
  currency: string | null;
  images: string[];
  inStock: boolean | null;
  brand: string | null;
  sourceUrl: string;
};

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripTags(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function firstMetaContent(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtmlEntities(m[1].trim());
  }
  return null;
}

function parsePriceNumber(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).replace(/[^\d.,-]/g, "").replace(/,(?=\d{3}\b)/g, "").replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function collectJsonLd(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
      // ignore malformed json-ld
    }
  }
  // flatten @graph
  const flat: any[] = [];
  for (const item of out) {
    if (item && Array.isArray(item["@graph"])) flat.push(...item["@graph"]);
    else flat.push(item);
  }
  return flat;
}

function findProductNode(nodes: any[]): any | null {
  for (const n of nodes) {
    const t = n?.["@type"];
    if (t === "Product" || (Array.isArray(t) && t.includes("Product"))) return n;
  }
  return null;
}

function absolutize(url: string, base: string): string {
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

export const scrapeProductUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ url: z.string().url() }))
  .handler(async ({ data, context }): Promise<ScrapedProduct> => {
    // Super admin only
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "super_admin");
    if (!isAdmin) throw new Response("Forbidden: super_admin only", { status: 403 });

    const res = await fetch(data.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; EasyStoreBot/1.0; +https://easystorebd.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
    const html = await res.text();

    const jsonLd = collectJsonLd(html);
    const product = findProductNode(jsonLd);

    // Name
    const name =
      product?.name ??
      firstMetaContent(html, [
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
        /<title>([^<]+)<\/title>/i,
      ]) ??
      "";

    // Description
    let description = "";
    if (product?.description) description = String(product.description);
    else {
      description =
        firstMetaContent(html, [
          /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
          /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
        ]) ?? "";
    }
    description = stripTags(description);

    // Offers / price / stock
    let price: number | null = null;
    let regularPrice: number | null = null;
    let currency: string | null = null;
    let inStock: boolean | null = null;
    const offers = product?.offers;
    const offerArr = Array.isArray(offers) ? offers : offers ? [offers] : [];
    for (const o of offerArr) {
      const p = parsePriceNumber(o?.price ?? o?.lowPrice);
      if (p != null && price == null) price = p;
      const hp = parsePriceNumber(o?.highPrice);
      if (hp != null && regularPrice == null) regularPrice = hp;
      if (!currency && (o?.priceCurrency || o?.currency)) currency = String(o.priceCurrency ?? o.currency);
      const avail = String(o?.availability ?? "").toLowerCase();
      if (avail.includes("instock")) inStock = true;
      else if (avail.includes("outofstock") || avail.includes("soldout")) inStock = false;
    }
    if (price == null) {
      const metaPrice = firstMetaContent(html, [
        /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+property=["']og:price:amount["'][^>]+content=["']([^"']+)["']/i,
      ]);
      price = parsePriceNumber(metaPrice);
    }

    // Images
    const images: string[] = [];
    const pushImg = (u: unknown) => {
      if (!u) return;
      if (Array.isArray(u)) return u.forEach(pushImg);
      if (typeof u === "object" && u && "url" in (u as any)) return pushImg((u as any).url);
      const abs = absolutize(String(u), data.url);
      if (abs && !images.includes(abs)) images.push(abs);
    };
    pushImg(product?.image);
    const ogImg = firstMetaContent(html, [
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    ]);
    if (ogImg) pushImg(ogImg);

    const brand =
      (typeof product?.brand === "string"
        ? product.brand
        : product?.brand?.name) ?? null;

    return {
      name: decodeHtmlEntities(String(name).trim()),
      description,
      price,
      regularPrice,
      currency,
      images: images.slice(0, 10),
      inStock,
      brand,
      sourceUrl: data.url,
    };
  });
