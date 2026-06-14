import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "./mock-data";

export type Session = {
  name: string;
  email: string;
  role: Role;
  store: string;
};

/**
 * Resolves the current authenticated session by combining Supabase auth with
 * the server-side `profiles` and `user_roles` tables. Never trusts client-only
 * storage for role information.
 */
async function loadSession(): Promise<Session | null> {
  const { data: { session: authSession } } = await supabase.auth.getSession();
  if (!authSession?.user) return null;

  const userId = authSession.user.id;
  const email = authSession.user.email ?? "";

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("name, store").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);

  // Role precedence: highest privilege wins.
  const order: Role[] = [
    "super_admin", "store_owner", "manager", "accountant",
    "warehouse_manager", "technician", "cashier", "salesman",
  ];
  const heldRoles = (roles ?? []).map((r) => r.role as Role);
  const role = order.find((r) => heldRoles.includes(r)) ?? "salesman";

  return {
    name: profile?.name?.trim() || email.split("@")[0] || "User",
    email,
    role,
    store: profile?.store?.trim() || "Bongo Store",
  };
}

export async function signOut() {
  await supabase.auth.signOut();
}

export function useSession() {
  const [session, setS] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Subscribe FIRST so we never miss an auth event.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, authSession) => {
      if (!authSession) {
        if (!cancelled) setS(null);
        return;
      }
      // Defer DB lookups out of the auth callback to avoid deadlocks.
      setTimeout(() => {
        loadSession().then((s) => { if (!cancelled) setS(s); });
      }, 0);
    });

    loadSession().then((s) => { if (!cancelled) setS(s); });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return session;
}
