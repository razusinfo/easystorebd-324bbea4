import { CANONICAL_AUTH_ORIGIN } from "@/lib/oauth-host-check";

const OAUTH_REDIRECT_KEY = "easystore:oauth:redirect";
const OAUTH_MODE_KEY = "easystore:oauth:mode";

export function sanitizeAuthRedirect(value: string | null | undefined): string | null {
  if (!value?.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  try {
    const url = new URL(value, "https://easystorebd.lovable.app");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function rememberOAuthReturn(redirect: string | null | undefined, mode?: "signin" | "signup") {
  if (typeof window === "undefined") return;
  const safe = sanitizeAuthRedirect(redirect) ?? "";
  try {
    window.sessionStorage.setItem(OAUTH_REDIRECT_KEY, safe);
    window.localStorage.setItem(OAUTH_REDIRECT_KEY, safe);
    if (mode) {
      window.sessionStorage.setItem(OAUTH_MODE_KEY, mode);
      window.localStorage.setItem(OAUTH_MODE_KEY, mode);
    }
  } catch {
    /* storage may be unavailable */
  }
}

export function consumeOAuthReturn(): { redirect: string | null; mode: "signin" | "signup" | null } {
  if (typeof window === "undefined") return { redirect: null, mode: null };
  let redirect: string | null = null;
  let mode: "signin" | "signup" | null = null;
  try {
    redirect = sanitizeAuthRedirect(
      window.sessionStorage.getItem(OAUTH_REDIRECT_KEY) ?? window.localStorage.getItem(OAUTH_REDIRECT_KEY),
    );
    const storedMode = window.sessionStorage.getItem(OAUTH_MODE_KEY) ?? window.localStorage.getItem(OAUTH_MODE_KEY);
    mode = storedMode === "signin" || storedMode === "signup" ? storedMode : null;
    window.sessionStorage.removeItem(OAUTH_REDIRECT_KEY);
    window.sessionStorage.removeItem(OAUTH_MODE_KEY);
    window.localStorage.removeItem(OAUTH_REDIRECT_KEY);
    window.localStorage.removeItem(OAUTH_MODE_KEY);
  } catch {
    /* ignore */
  }
  return { redirect, mode };
}

export function buildOAuthRecoveryUrl(path: "/auth" | "/login", redirect?: string | null, mode?: "signin" | "signup") {
  const target = new URL(path, CANONICAL_AUTH_ORIGIN);
  const safe = sanitizeAuthRedirect(redirect);
  if (safe) target.searchParams.set("redirect", safe);
  if (path === "/auth" && mode) target.searchParams.set("mode", mode);
  return target.toString();
}
