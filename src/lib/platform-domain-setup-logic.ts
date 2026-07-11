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
    return "Verify the wildcard first, then tick “Mark step complete” to finish.";
  }
  return "Tick “Mark step complete” before moving on — this keeps setup progress accurate on reload.";
}

export function completedCount(setup: PlatformSetupState | null | undefined): number {
  if (!setup) return 0;
  return PLATFORM_STEP_KEYS.reduce((n, k) => n + (setup[k] ? 1 : 0), 0);
}
