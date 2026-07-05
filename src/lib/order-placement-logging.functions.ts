// Server-side logging for order placement attempts. Guests are allowed to
// place orders on published stores, so this endpoint is intentionally public
// (no auth middleware). The log lands in server-function logs, which is what
// we use to debug RLS / missing-grant regressions.
import { createServerFn } from "@tanstack/react-start";

export type OrderAttemptOutcome = "success" | "order_insert_failed" | "items_insert_failed";

type LogInput = {
  outcome: OrderAttemptOutcome;
  store_id: string;
  order_id?: string | null;
  order_number?: string | null;
  customer_user_id?: string | null;
  role?: string | null;
  item_count: number;
  total: number;
  error_kind?: string | null;
  error_code?: string | null;
  error_message?: string | null;
};

export const logOrderPlacementAttempt = createServerFn({ method: "POST" })
  .inputValidator((input: LogInput) => input)
  .handler(async ({ data }) => {
    // Keep payload compact and PII-free (no name/phone/address).
    const payload = {
      tag: "order_placement_attempt",
      outcome: data.outcome,
      store_id: data.store_id,
      order_id: data.order_id ?? null,
      order_number: data.order_number ?? null,
      customer_user_id: data.customer_user_id ?? null,
      role: data.role ?? (data.customer_user_id ? "authenticated" : "anon"),
      item_count: data.item_count,
      total: data.total,
      error_kind: data.error_kind ?? null,
      error_code: data.error_code ?? null,
      error_message: data.error_message ?? null,
      at: new Date().toISOString(),
    };
    if (data.outcome === "success") {
      console.log(JSON.stringify(payload));
    } else {
      console.error(JSON.stringify(payload));
    }
    return { ok: true as const };
  });
