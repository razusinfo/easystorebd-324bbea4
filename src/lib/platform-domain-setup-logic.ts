/**
 * Pure logic for the Platform Domain Setup wizard.
 *
 * Extracted so it can be unit-tested without a browser: given the persisted
 * setup row, decide which step is active, whether Next / Continue is enabled,
 * and what error message to show when the user tries to advance too early.
 */

export const PLATFORM_STEP_KEYS = [
  "cloudflare_added",
  "nameservers_updated",
  "dns_records_added",
  "ssl_mode_set",
  "lovable_wildcard_connected",
] as const;

export type PlatformStepKey = (typeof PLATFORM_STEP_KEYS)[number];

export type PlatformSetupState = Partial<Record<PlatformStepKey, boolean>> & {
  current_step?: number | null;
};

export function clampStep(step: number | null | undefined): number {
  const n = Number(step ?? 1);
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(1, Math.trunc(n)), PLATFORM_STEP_KEYS.length);
}

export function isStepDone(setup: PlatformSetupState | null | undefined, idx: number): boolean {
  const key = PLATFORM_STEP_KEYS[idx];
  return !!(setup && key && setup[key]);
}

/**
 * A step's Next/Continue button is enabled only when the current step is
 * marked complete. This prevents users from silently skipping DNS work and
 * ending up "finished" without a working wildcard.
 */
export function canAdvance(setup: PlatformSetupState | null | undefined, currentStepIdx: number): boolean {
  return isStepDone(setup, currentStepIdx);
}

export function advanceBlockedMessage(currentStepIdx: number): string {
  const isLast = currentStepIdx === PLATFORM_STEP_KEYS.length - 1;
  if (isLast) {
    return "Verify the wildcard first, then tick “Mark step complete” to finish. (আগে wildcard verify করুন, তারপর “Mark step complete” টিক দিয়ে শেষ করুন।)";
  }
  return "Tick “Mark step complete” before moving on — this keeps setup progress accurate on reload. (এগোনোর আগে “Mark step complete” টিক দিন — রিলোডে সঠিক ধাপে ফিরে আসতে এটা দরকার।)";
}

export function completedCount(setup: PlatformSetupState | null | undefined): number {
  if (!setup) return 0;
  return PLATFORM_STEP_KEYS.reduce((n, k) => n + (setup[k] ? 1 : 0), 0);
}

/**
 * Lovable's "Connect domain" dialog rejects any hostname containing `*`
 * (including the common `*.example.com` wildcard form) — the Continue
 * button silently disables. We strip a leading wildcard label so the user
 * can still connect the apex domain; the Cloudflare wildcard A-record
 * covers reseller subdomains at the DNS layer.
 *
 * Returns the sanitized hostname plus flags describing what happened so
 * the UI can show an inline error, a toast, and disable Continue when the
 * remaining value is still invalid.
 */
export type SanitizedHostname = {
  original: string;
  sanitized: string;
  stripped: boolean;
  hasInvalidWildcard: boolean;
  isValid: boolean;
  message: string | null;
};

const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export function sanitizeLovableHostname(input: string): SanitizedHostname {
  const original = (input ?? "").trim();
  // Strip protocol + trailing slash so paste from browser works.
  let value = original.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");

  let stripped = false;
  // Repeatedly strip leading `*.` labels: `*.*.foo.com` → `foo.com`.
  while (/^\*\./.test(value)) {
    value = value.slice(2);
    stripped = true;
  }

  const hasInvalidWildcard = value.includes("*");
  const isValid = !hasInvalidWildcard && HOSTNAME_RE.test(value);

  let message: string | null = null;
  if (hasInvalidWildcard) {
    message = "Lovable-এর Connect Domain ইনপুট `*` character গ্রহণ করে না — Continue disable হয়ে যায়।";
  } else if (stripped) {
    message = `wildcard prefix (*.) বাদ দিয়ে "${value}" ব্যবহার করা হয়েছে।`;
  } else if (value && !isValid) {
    message = "একটি বৈধ hostname দিন (যেমন easystorebd.com)।";
  }

  return { original, sanitized: value, stripped, hasInvalidWildcard, isValid, message };
}
