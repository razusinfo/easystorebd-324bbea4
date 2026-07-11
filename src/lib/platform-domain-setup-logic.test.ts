import { describe, it, expect } from "vitest";
import {
  PLATFORM_STEP_KEYS,
  advanceBlockedMessage,
  canAdvance,
  clampStep,
  completedCount,
  isStepDone,
  sanitizeLovableHostname,
} from "./platform-domain-setup-logic";

describe("platform domain setup logic", () => {
  it("clamps current_step into the valid range and defaults to 1", () => {
    expect(clampStep(null)).toBe(1);
    expect(clampStep(undefined)).toBe(1);
    expect(clampStep(0)).toBe(1);
    expect(clampStep(-5)).toBe(1);
    expect(clampStep(3)).toBe(3);
    expect(clampStep(99)).toBe(PLATFORM_STEP_KEYS.length);
    expect(clampStep(Number.NaN)).toBe(1);
  });

  it("reports step completion from the persisted row", () => {
    const setup = { cloudflare_added: true, dns_records_added: false };
    expect(isStepDone(setup, 0)).toBe(true);
    expect(isStepDone(setup, 2)).toBe(false);
    expect(isStepDone(null, 0)).toBe(false);
  });

  it("blocks Continue until the current step is marked complete", () => {
    const setup = { cloudflare_added: false };
    expect(canAdvance(setup, 0)).toBe(false);
    expect(advanceBlockedMessage(0)).toMatch(/Mark step complete/);

    const done = { cloudflare_added: true };
    expect(canAdvance(done, 0)).toBe(true);
  });

  it("uses a wildcard-specific message on the final verification step", () => {
    const lastIdx = PLATFORM_STEP_KEYS.length - 1;
    expect(advanceBlockedMessage(lastIdx)).toMatch(/Verify the wildcard/);
  });

  it("counts completed steps for the progress bar and persists across reloads", () => {
    const persisted = {
      cloudflare_added: true,
      nameservers_updated: true,
      dns_records_added: false,
      ssl_mode_set: false,
      lovable_wildcard_connected: false,
      current_step: 3,
    };
    expect(completedCount(persisted)).toBe(2);
    // Simulate reload: fresh render reads the same row, so we resume on step 3.
    expect(clampStep(persisted.current_step)).toBe(3);
    expect(isStepDone(persisted, 2)).toBe(false);
    expect(canAdvance(persisted, 2)).toBe(false);
  });

  it("marks setup finished only when every step is complete", () => {
    const finished: Record<string, boolean> = {};
    for (const k of PLATFORM_STEP_KEYS) finished[k] = true;
    expect(completedCount(finished)).toBe(PLATFORM_STEP_KEYS.length);
    expect(canAdvance(finished, PLATFORM_STEP_KEYS.length - 1)).toBe(true);
  });

  describe("sanitizeLovableHostname (Step 5 Connect Domain e2e behavior)", () => {
    it("strips the `*.` wildcard prefix so Continue stays enabled with the apex domain", () => {
      const r = sanitizeLovableHostname("*.easystorebd.com");
      expect(r.sanitized).toBe("easystorebd.com");
      expect(r.stripped).toBe(true);
      expect(r.hasInvalidWildcard).toBe(false);
      expect(r.isValid).toBe(true);
      expect(r.message).toMatch(/easystorebd\.com/);
    });

    it("still flags stray `*` characters mid-hostname so Continue stays disabled", () => {
      const r = sanitizeLovableHostname("foo.*.easystorebd.com");
      expect(r.hasInvalidWildcard).toBe(true);
      expect(r.isValid).toBe(false);
      expect(r.message).toMatch(/Continue disable/);
    });

    it("passes a clean apex through unchanged and marks it valid", () => {
      const r = sanitizeLovableHostname("easystorebd.com");
      expect(r.sanitized).toBe("easystorebd.com");
      expect(r.stripped).toBe(false);
      expect(r.isValid).toBe(true);
      expect(r.message).toBeNull();
    });

    it("normalizes protocol and trailing slash paste from browser", () => {
      const r = sanitizeLovableHostname("https://*.easystorebd.com/");
      expect(r.sanitized).toBe("easystorebd.com");
      expect(r.isValid).toBe(true);
    });
  });
});
