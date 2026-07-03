// Guarded PWA service-worker registration.
// Registers /sw.js only in real production browsers, never in Lovable preview/iframe/dev.
// Supports ?sw=off to kill any existing registration.

const SW_PATH = "/sw.js";

function isRefusedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!("serviceWorker" in navigator)) return true;
  if (!import.meta.env.PROD) return true;

  try {
    if (window.top !== window.self) return true; // inside iframe
  } catch {
    return true; // cross-origin iframe access blocked
  }

  const host = window.location.hostname;
  if (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  ) {
    return true;
  }

  if (new URLSearchParams(window.location.search).get("sw") === "off") {
    return true;
  }

  return false;
}

async function unregisterOurSw() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      regs
        .filter((r) => r.active?.scriptURL?.endsWith(SW_PATH) || r.installing?.scriptURL?.endsWith(SW_PATH))
        .map((r) => r.unregister()),
    );
  } catch {
    /* noop */
  }
}

export function registerPwa() {
  if (typeof window === "undefined") return;
  if (isRefusedContext()) {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      void unregisterOurSw();
    }
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(SW_PATH, { scope: "/" })
      .catch((err) => console.warn("[pwa] SW register failed:", err));
  });
}
