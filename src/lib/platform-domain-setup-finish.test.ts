import { describe, expect, it } from "vitest";
import {
  PLATFORM_STEP_KEYS,
  clampStep,
  completedCount,
  type PlatformSetupState,
} from "./platform-domain-setup-logic";

/**
 * Pure-logic tests for the Finish button + reload behavior of the
 * Platform Domain Setup wizard.
 *
 * The component derives Finish enablement from:
 *   incompleteSteps = STEPS.filter((s) => !setup?.[s.key])
 *   allStepsDone    = incompleteSteps.length === 0
 * On click it persists { current_step: STEPS.length, ...allKeysTrue }
 * and navigates to /admin. On reload the same query result restores the
 * completed state via clampStep + completedCount.
 */

function incompleteSteps(setup: PlatformSetupState | null) {
  return PLATFORM_STEP_KEYS.filter((k) => !setup?.[k]);
}
function allDone(setup: PlatformSetupState | null) {
  return incompleteSteps(setup).length === 0;
}
function finishPatch(): Record<string, boolean | number> {
  const patch: Record<string, boolean | number> = { current_step: PLATFORM_STEP_KEYS.length };
  for (const k of PLATFORM_STEP_KEYS) patch[k] = true;
  return patch;
}

describe("Platform Domain Setup — Finish button gating", () => {
  it("disabled when no steps done", () => {
    expect(allDone(null)).toBe(false);
    expect(allDone({})).toBe(false);
    expect(incompleteSteps({}).length).toBe(5);
  });

  it("disabled when only some steps done", () => {
    const setup: PlatformSetupState = {
      cloudflare_added: true,
      nameservers_updated: true,
      dns_records_added: true,
      ssl_mode_set: true,
      // final wildcard step still missing
    };
    expect(allDone(setup)).toBe(false);
    expect(incompleteSteps(setup)).toEqual(["lovable_wildcard_connected"]);
  });

  it("enabled only after all 5 steps are complete", () => {
    const setup: PlatformSetupState = Object.fromEntries(
      PLATFORM_STEP_KEYS.map((k) => [k, true]),
    );
    expect(allDone(setup)).toBe(true);
    expect(incompleteSteps(setup)).toEqual([]);
  });
});

describe("Platform Domain Setup — Finish click persistence + reload", () => {
  it("persists all 5 keys + final current_step", () => {
    const patch = finishPatch();
    expect(patch.current_step).toBe(5);
    for (const k of PLATFORM_STEP_KEYS) expect(patch[k]).toBe(true);
  });

  it("simulated Finish flow saves state, navigates to /admin, and reload resumes complete", async () => {
    // Simulated Supabase row + navigation.
    let row: PlatformSetupState = { current_step: 5 };
    for (const k of PLATFORM_STEP_KEYS) row[k] = false;

    const nav: string[] = [];
    const navigate = (to: string) => nav.push(to);
    const saveMock = async (patch: Record<string, boolean | number>) => {
      row = { ...row, ...patch } as PlatformSetupState;
    };

    // User completes all 5 steps via the checkbox flow.
    for (const k of PLATFORM_STEP_KEYS) await saveMock({ [k]: true });
    expect(allDone(row)).toBe(true);

    // Click Finish -> save + navigate.
    if (allDone(row)) {
      await saveMock(finishPatch());
      navigate("/admin");
    }

    expect(nav).toEqual(["/admin"]);
    expect(row.current_step).toBe(5);
    expect(completedCount(row)).toBe(5);

    // Simulate reload / new login: same row, wizard restores step 5 done.
    const reloaded = row;
    expect(clampStep(reloaded.current_step)).toBe(5);
    expect(completedCount(reloaded)).toBe(PLATFORM_STEP_KEYS.length);
    expect(allDone(reloaded)).toBe(true);
  });

  it("Finish is blocked (no save, no navigation) when any step is incomplete", async () => {
    let row: PlatformSetupState = {
      cloudflare_added: true,
      nameservers_updated: true,
      dns_records_added: true,
      ssl_mode_set: false,
      lovable_wildcard_connected: true,
      current_step: 5,
    };
    const nav: string[] = [];
    let saved = false;
    const navigate = (to: string) => nav.push(to);
    const saveMock = async (patch: Record<string, boolean | number>) => {
      saved = true;
      row = { ...row, ...patch };
    };

    if (allDone(row)) {
      await saveMock(finishPatch());
      navigate("/admin");
    }
    expect(saved).toBe(false);
    expect(nav).toEqual([]);
    expect(incompleteSteps(row)).toEqual(["ssl_mode_set"]);
  });
});
