import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({
  phone: z.string().trim().min(4).max(32),
});

function normalize(p: string): string {
  // Strip everything except digits; compare on last 10-15 digits.
  return p.replace(/\D+/g, "");
}

/**
 * Resolve a customer's email from a mobile number so the client can
 * complete `signInWithPassword({ email, password })`. Matches auth users
 * whose `phone` column OR `user_metadata.phone` matches by digits.
 * Throws a generic error when not found (do not leak enumeration details).
 */
export const emailForPhone = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const target = normalize(data.phone);
    if (target.length < 6) throw new Error("Invalid mobile number");

    // Paginate through users; typical stores are small, cap at 5 pages.
    for (let page = 1; page <= 5; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page, perPage: 200,
      });
      if (error) throw new Error(error.message);
      const users = list?.users ?? [];
      const match = users.find((u) => {
        const cands = [
          u.phone ?? "",
          (u.user_metadata as Record<string, unknown> | null)?.phone as string | undefined ?? "",
        ].map(normalize);
        return cands.some((c) => c.length >= 6 && (c === target || c.endsWith(target) || target.endsWith(c)));
      });
      if (match?.email) return { email: match.email };
      if (users.length < 200) break;
    }
    throw new Error("No account found for this mobile number");
  });
