import { createFileRoute } from "@tanstack/react-router";

/**
 * Public splash-logo proxy.
 *
 * URL shape: `/api/public/splash-logo/<store_id>?v=<version>`
 *
 * Streams the store's splash-screen logo from the private `store-logos`
 * bucket through the edge with CDN-friendly caching. Because the URL
 * contains the store's current splash version (last-updated ms), a save
 * automatically invalidates any downstream cache while unrelated stores
 * keep serving from the edge.
 *
 * No PII is exposed: the endpoint returns image bytes only, and 404s when
 * the store has no splash logo configured.
 */
export const Route = createFileRoute("/api/public/splash-logo/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const rawId = (params as { _splat?: string })._splat ?? "";
        // Splat may include a trailing "/<version>" segment; the ID is the
        // first UUID-shaped chunk. Strip anything after the first slash.
        const storeId = rawId.split("/")[0]?.trim() ?? "";
        if (!/^[0-9a-f-]{36}$/i.test(storeId)) {
          return new Response("Bad store id", { status: 400 });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const { data: store, error: storeError } = await supabaseAdmin
          .from("stores")
          .select("id, shop_settings")
          .eq("id", storeId)
          .maybeSingle();

        if (storeError) {
          console.error(
            `[splash-logo] store lookup failed [${storeError.code}]: ${storeError.message}`,
          );
          return new Response("Lookup failed", { status: 502 });
        }
        const splashCfg = (store?.shop_settings as any)?.splash ?? null;
        const splashPath: string | null = splashCfg?.logo_path ?? null;
        if (!store || !splashPath) {
          return new Response("Not found", { status: 404 });
        }

        // ETag is derived from the storage object path so browsers can revalidate
        // cheaply. The `?v=` query already handles hard busts on save.
        const etag = `W/"splash-${storeId}-${Buffer.from(splashPath).toString("base64url").slice(0, 24)}"`;
        if (request.headers.get("if-none-match") === etag) {
          return new Response(null, {
            status: 304,
            headers: { ETag: etag },
          });
        }

        const { data: blob, error: dlError } = await supabaseAdmin.storage
          .from("store-logos")
          .download(splashPath);
        if (dlError || !blob) {
          console.error(
            `[splash-logo] download failed for ${storeId}: ${dlError?.message ?? "no blob"}`,
          );
          return new Response("Asset unavailable", { status: 502 });
        }

        const bytes = new Uint8Array(await blob.arrayBuffer());
        const contentType = blob.type || guessContentType(splashPath);

        return new Response(bytes, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            // Short browser cache + longer edge cache + SWR for instant
            // subsequent paints while still allowing quick invalidation via
            // the `?v=` query bump.
            "Cache-Control":
              "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
            ETag: etag,
            Vary: "Accept-Encoding",
          },
        });
      },
    },
  },
});

function guessContentType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "webp": return "image/webp";
    case "svg": return "image/svg+xml";
    case "gif": return "image/gif";
    default: return "application/octet-stream";
  }
}
