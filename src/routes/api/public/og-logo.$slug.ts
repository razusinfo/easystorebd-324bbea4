import { createFileRoute } from "@tanstack/react-router";

/**
 * Public store-logo proxy keyed by slug — used as og:image for storefront
 * social sharing (Facebook, WhatsApp, Twitter). Streams the store logo
 * from the private `store-logos` bucket through the edge with CDN caching.
 */
export const Route = createFileRoute("/api/public/og-logo/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = String(params.slug ?? "").trim().toLowerCase();
        if (!/^[a-z0-9-]{2,64}$/.test(slug)) {
          return new Response("Bad slug", { status: 400 });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const { data: store } = await supabaseAdmin
          .from("stores")
          .select("logo_url")
          .eq("slug", slug)
          .eq("published", true)
          .maybeSingle();

        const path = store?.logo_url ?? null;
        if (!path) return new Response("Not found", { status: 404 });

        const { data: blob, error } = await supabaseAdmin.storage
          .from("store-logos")
          .download(path);
        if (error || !blob) return new Response("Unavailable", { status: 502 });

        const bytes = new Uint8Array(await blob.arrayBuffer());
        const ext = path.split(".").pop()?.toLowerCase();
        const type =
          blob.type ||
          (ext === "png" ? "image/png"
            : ext === "webp" ? "image/webp"
            : ext === "svg" ? "image/svg+xml"
            : ext === "gif" ? "image/gif"
            : "image/jpeg");

        return new Response(bytes, {
          status: 200,
          headers: {
            "Content-Type": type,
            "Cache-Control":
              "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
          },
        });
      },
    },
  },
});
