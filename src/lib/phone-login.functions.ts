import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({
  phone: z.string().trim().min(4).max(32),
  password: z.string().min(1).max(200),
});

function normalize(p: string): string {
  return p.replace(/\D+/g, "");
}

/**
 * Sign in a storefront customer using their mobile number + password.
 *
 * The mapping from phone → email is done entirely server-side and the
 * resolved email is NEVER returned to the client. Doing the mapping
 * server-side (with the credential also required) closes the account
 * enumeration hole where an unauthenticated caller could submit any phone
 * number and learn the associated email address — which is PII and a strong
 * primary for phishing / credential stuffing.
 *
 * On success returns the same `{ access_token, refresh_token }` pair the
 * browser Supabase client needs for `supabase.auth.setSession(...)`.
 * On failure a single generic message is returned so callers cannot tell
 * "no account for this phone" apart from "wrong password".
 */
export const signInWithPhone = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const target = normalize(data.phone);
    if (target.length < 6) throw new Error("Invalid credentials");

    // Paginate through users to find the phone owner. Small stores → few pages.
    let email: string | null = null;
    for (let page = 1; page <= 5; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page, perPage: 200,
      });
      if (error) {
        // Do not leak internal errors; treat as auth failure.
        throw new Error("Invalid credentials");
      }
      const users = list?.users ?? [];
      const match = users.find((u) => {
        const cands = [
          u.phone ?? "",
          (u.user_metadata as Record<string, unknown> | null)?.phone as string | undefined ?? "",
        ].map(normalize);
        return cands.some((c) => c.length >= 6 && (c === target || c.endsWith(target) || target.endsWith(c)));
      });
      if (match?.email) { email = match.email; break; }
      if (users.length < 200) break;
    }
    if (!email) {
      // Generic error — never disclose whether the phone exists.
      throw new Error("Invalid credentials");
    }

    // Use a publishable-key client so the sign-in path is the same PKCE-style
    // flow as the browser and rate-limits still apply.
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: session, error } = await supabase.auth.signInWithPassword({
      email,
      password: data.password,
    });
    if (error || !session.session) {
      throw new Error("Invalid credentials");
    }
    return {
      access_token: session.session.access_token,
      refresh_token: session.session.refresh_token,
    };
  });
