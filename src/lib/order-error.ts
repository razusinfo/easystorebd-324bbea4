// Format a Supabase error from an order placement attempt into a user-facing
// message that reveals the exact reason (RLS, missing grant, validation, etc.)
// so shoppers and support see what actually blocked "Place order".

export type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
} | null | undefined;

export type OrderErrorStage = "order" | "items";

export type FormattedOrderError = {
  /** Short human-readable summary (safe to show in a toast). */
  title: string;
  /** Extended description with code + details/hint when present. */
  description: string;
  /** Coarse category — useful for logging / analytics. */
  kind:
    | "rls_violation"
    | "missing_grant"
    | "validation"
    | "constraint"
    | "network"
    | "unknown";
};

const RLS_CODES = new Set(["42501"]);           // insufficient privilege / RLS
const CHECK_CODES = new Set(["23514"]);         // check constraint
const UNIQUE_CODES = new Set(["23505"]);        // unique violation
const FK_CODES = new Set(["23503"]);            // foreign key
const NOT_NULL_CODES = new Set(["23502"]);      // not null

export function classifyOrderError(err: SupabaseLikeError): FormattedOrderError["kind"] {
  if (!err) return "unknown";
  const code = (err.code ?? "").toString();
  const msg = (err.message ?? "").toLowerCase();
  if (RLS_CODES.has(code) || msg.includes("row-level security") || msg.includes("row level security")) {
    return "rls_violation";
  }
  if (msg.includes("permission denied") || msg.includes("must be owner")) {
    return "missing_grant";
  }
  if (CHECK_CODES.has(code)) return "validation";
  if (UNIQUE_CODES.has(code) || FK_CODES.has(code) || NOT_NULL_CODES.has(code)) return "constraint";
  if (msg.includes("failed to fetch") || msg.includes("networkerror")) return "network";
  return "unknown";
}

export function formatOrderError(
  err: SupabaseLikeError,
  stage: OrderErrorStage,
): FormattedOrderError {
  const kind = classifyOrderError(err);
  const code = err?.code ? String(err.code) : "";
  const rawMessage = err?.message?.trim() || "Unknown error";
  const extras = [err?.details, err?.hint].filter((s): s is string => !!s && s.length > 0);

  let title: string;
  switch (kind) {
    case "rls_violation":
      title = stage === "order"
        ? "Order blocked by store access rules"
        : "Order items blocked by store access rules";
      break;
    case "missing_grant":
      title = "Database permission denied — please contact the store";
      break;
    case "validation":
      title = "Order rejected: some values are outside the allowed range";
      break;
    case "constraint":
      title = "Order rejected by a database constraint";
      break;
    case "network":
      title = "Network problem — please check your connection and retry";
      break;
    default:
      title = stage === "order" ? "Could not place order" : "Could not save order items";
  }

  const description = [
    code ? `[${code}] ${rawMessage}` : rawMessage,
    ...extras,
  ].join(" — ");

  return { title, description, kind };
}
