// Server-side logging for order placement attempts. Guests are allowed to
// place orders on published stores, so this endpoint is intentionally public
// (no auth middleware). The log lands in server-function logs, which is what
// we use to debug RLS / missing-grant regressions.
//
// Because it is unauthenticated, every field is validated and length-capped
// with zod to block log flooding and log-injection attempts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type OrderAttemptOutcome = "success" | "order_insert_failed" | "items_insert_failed";

const OUTCOMES: readonly OrderAttemptOutcome[] = [
  "success",
  "order_insert_failed",
  "items_insert_failed",
] as const;

const ERROR_KINDS = [
  "rls_violation",
  "missing_grant",
  "validation",
  "constraint",
  "network",
  "unknown",
] as const;

// Reject control characters that could corrupt log lines.
const noControlChars = /^[^\u0000-\u001f\u007f]*$/;

const uuid = z.string().uuid();
const shortStr = (max: number) =>
  z.string().max(max).regex(noControlChars, "control characters not allowed");

const logSchema = z.object({
  outcome: z.enum(OUTCOMES as unknown as [OrderAttemptOutcome, ...OrderAttemptOutcome[]]),
  store_id: uuid,
  order_id: uuid.nullish(),
  order_number: shortStr(64).nullish(),
  customer_user_id: uuid.nullish(),
  role: shortStr(32).nullish(),
  item_count: z.number().int().min(0).max(10_000),
  total: z.number().min(0).max(1_000_000_000).finite(),
  error_kind: z.enum(ERROR_KINDS).nullish(),
  error_code: shortStr(32).nullish(),
  error_message: shortStr(500).nullish(),
});

export type LogOrderAttemptInput = z.infer<typeof logSchema>;

export const logOrderPlacementAttempt = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): LogOrderAttemptInput => logSchema.parse(input))
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
