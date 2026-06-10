import { useEffect, useState } from "react";
import type { Role } from "./mock-data";

export type Session = {
  name: string;
  email: string;
  role: Role;
  store: string;
};

const KEY = "bongo.session";

export const defaultSession: Session = {
  name: "Demo Owner",
  email: "demo@bongoinventory.bd",
  role: "store_owner",
  store: "Bongo Demo Store",
};

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setSession(s: Session | null) {
  if (typeof window === "undefined") return;
  if (s) localStorage.setItem(KEY, JSON.stringify(s));
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("bongo:session"));
}

export function useSession() {
  const [session, setS] = useState<Session | null>(null);
  useEffect(() => {
    setS(getSession());
    const h = () => setS(getSession());
    window.addEventListener("bongo:session", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("bongo:session", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return session;
}
