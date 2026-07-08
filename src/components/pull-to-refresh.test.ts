import { describe, it, expect } from "vitest";
import {
  decideGesture,
  shouldTriggerRefresh,
  P2R_THRESHOLD,
  P2R_MAX_PULL,
} from "@/components/pull-to-refresh";

describe("pull-to-refresh gesture logic", () => {
  it("cancels when the page is not scrolled to the very top", () => {
    // Simulates normal scrolling: any downward touch mid-page must not trigger.
    expect(decideGesture({ dy: 200, dx: 0, scrollTop: 50, decided: false }))
      .toEqual({ kind: "cancel" });
    expect(decideGesture({ dy: 200, dx: 0, scrollTop: 1, decided: true }))
      .toEqual({ kind: "cancel" });
  });

  it("cancels on upward swipes even at the top", () => {
    expect(decideGesture({ dy: -30, dx: 0, scrollTop: 0, decided: false }))
      .toEqual({ kind: "cancel" });
  });

  it("ignores tiny movements under the start delta", () => {
    expect(decideGesture({ dy: 3, dx: 0, scrollTop: 0, decided: false }))
      .toEqual({ kind: "ignore" });
  });

  it("cancels horizontal-dominant gestures (swipe back / carousel)", () => {
    expect(decideGesture({ dy: 12, dx: 40, scrollTop: 0, decided: false }))
      .toEqual({ kind: "cancel" });
  });

  it("engages pull for clear vertical drag at the top", () => {
    const d = decideGesture({ dy: 40, dx: 5, scrollTop: 0, decided: false });
    expect(d.kind).toBe("pull");
    if (d.kind === "pull") expect(d.pull).toBeCloseTo(20); // damped 0.5x
  });

  it("caps damped pull distance at MAX_PULL", () => {
    const d = decideGesture({ dy: 1000, dx: 0, scrollTop: 0, decided: true });
    expect(d.kind).toBe("pull");
    if (d.kind === "pull") expect(d.pull).toBe(P2R_MAX_PULL);
  });

  it("continues pulling once decided even for small deltas", () => {
    // After decided=true, tiny dy still produces a pull (no re-gate).
    const d = decideGesture({ dy: 4, dx: 0, scrollTop: 0, decided: true });
    expect(d.kind).toBe("pull");
  });

  it("only triggers refresh when past threshold and decided", () => {
    expect(shouldTriggerRefresh(P2R_THRESHOLD, true)).toBe(true);
    expect(shouldTriggerRefresh(P2R_THRESHOLD - 1, true)).toBe(false);
    expect(shouldTriggerRefresh(P2R_THRESHOLD + 50, false)).toBe(false);
  });
});
