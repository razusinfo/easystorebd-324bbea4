import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Called by the DB trigger `notify_supplier_on_new_reseller_order` via pg_net
// after a new reseller_order is inserted. Sends a heads-up email to every
// super_admin (the fulfilling supplier) using Resend. Protected by the
// shared RESELLER_WEBHOOK_SECRET so only our own database can invoke it.

const Body = z.object({ order_id: z.string().uuid() });

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/public/hooks/reseller-order-notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RESELLER_WEBHOOK_SECRET;
        if (!secret) return json({ error: "not configured" }, 500);
        const provided =
          request.headers.get("x-webhook-secret") ??
          (request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
        if (provided !== secret) return json({ error: "Unauthorized" }, 401);

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }
        const parsed = Body.safeParse(payload);
        if (!parsed.success) return json({ error: "Invalid input" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin
          .from("reseller_orders")
          .select(
            "id, product_name, quantity, reseller_price, customer_name, customer_phone, customer_address:shipping_address, notes, source_order_id, source",
          )
          .eq("id", parsed.data.order_id)
          .maybeSingle();
        if (!order) return json({ error: "not found" }, 404);

        // Look up super_admin emails via admin API.
        const { data: rolesRows } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "super_admin");
        const ids = (rolesRows ?? []).map((r) => r.user_id);
        const emails: string[] = [];
        for (const id of ids) {
          try {
            const { data } = await supabaseAdmin.auth.admin.getUserById(id);
            if (data.user?.email) emails.push(data.user.email);
          } catch {
            /* ignore */
          }
        }
        if (emails.length === 0) return json({ ok: true, skipped: "no super_admins" });

        const key = process.env.RESEND_API_KEY;
        if (!key) return json({ ok: true, skipped: "no RESEND_API_KEY" });

        const esc = (v: unknown) =>
          String(v ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        const short = order.id.slice(0, 8).toUpperCase();
        const total = Number(order.reseller_price ?? 0) * order.quantity;
        const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f6f7fb;padding:24px">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;margin:0 auto;box-shadow:0 1px 3px rgba(0,0,0,.06)">
    <tr><td style="padding:20px 24px;background:#0f172a;color:#fff;font-weight:700">EasyStore — New Reseller Order</td></tr>
    <tr><td style="padding:24px;color:#111">
      <h1 style="margin:0 0 12px;font-size:20px">Order #${esc(short)} needs fulfillment</h1>
      <p style="margin:0 0 16px;color:#334155">A reseller just received a customer order. Please prepare it for shipping.</p>
      <table width="100%" style="font-size:14px;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#64748b;width:35%">Product</td><td style="padding:6px 0;font-weight:600">${esc(order.product_name)} × ${esc(order.quantity)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Total</td><td style="padding:6px 0;font-weight:600">৳${esc(total.toLocaleString("en-BD"))}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Customer</td><td style="padding:6px 0">${esc(order.customer_name)}${order.customer_phone ? " · " + esc(order.customer_phone) : ""}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Ship to</td><td style="padding:6px 0">${esc(order.customer_address)}</td></tr>
      </table>
      <p style="margin:24px 0 0"><a href="https://easystorebd.com/admin-reseller-orders" style="background:#0f172a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Open orders dashboard</a></p>
    </td></tr>
  </table>
</body></html>`;

        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              from: "EasyStore Orders <orders@resend.dev>",
              to: emails,
              subject: `New reseller order #${short} — ${order.product_name}`,
              html,
            }),
          });
        } catch (e) {
          console.warn("[reseller-order-notify] email failed:", (e as Error).message);
        }
        return json({ ok: true, notified: emails.length });
      },
    },
  },
});
