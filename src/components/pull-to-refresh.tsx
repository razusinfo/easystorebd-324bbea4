import { useEffect, useRef, useState } from "react";
import { Loader2, ArrowDown, WifiOff, RefreshCw, X } from "lucide-react";

export const P2R_THRESHOLD = 70;
export const P2R_MAX_PULL = 120;
export const P2R_MIN_START_DELTA = 8;
export const P2R_HORIZONTAL_TOLERANCE = 1.2;

export type GestureDecision =
  | { kind: "ignore" }         // not enough movement yet
  | { kind: "cancel" }         // horizontal or upward → not a P2R gesture
  | { kind: "pull"; pull: number }; // active P2R with damped pull distance

/**
 * Pure gesture classifier — safe to unit-test without a DOM.
 * Only classifies as `pull` when the page is at the very top, dy is positive,
 * gesture is clearly vertical, and dy exceeds the minimum start delta.
 */
export function decideGesture(input: {
  dy: number;
  dx: number;
  scrollTop: number;
  decided: boolean;
}): GestureDecision {
  const { dy, dx, scrollTop, decided } = input;
  if (scrollTop > 0 || dy <= 0) return { kind: "cancel" };
  if (!decided) {
    if (Math.abs(dy) < P2R_MIN_START_DELTA) return { kind: "ignore" };
    if (Math.abs(dy) < Math.abs(dx) * P2R_HORIZONTAL_TOLERANCE) {
      return { kind: "cancel" };
    }
  }
  return { kind: "pull", pull: Math.min(P2R_MAX_PULL, dy * 0.5) };
}

/** Should the release at gesture-end trigger a refresh? */
export function shouldTriggerRefresh(pull: number, decided: boolean): boolean {
  return decided && pull >= P2R_THRESHOLD;
}

/** Returns current vertical scroll offset, handling iOS quirks. */
function getScrollTop(): number {
  return Math.max(
    0,
    window.scrollY ||
      document.scrollingElement?.scrollTop ||
      document.documentElement.scrollTop ||
      0,
  );
}

/** Global mobile pull-to-refresh: pull down from top to reload the page. */
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);

  const startY = useRef<number | null>(null);
  const startX = useRef<number | null>(null);
  const active = useRef(false);
  const decided = useRef(false);
  const pullRef = useRef(0);
  const onlineListener = useRef<(() => void) | null>(null);

  useEffect(() => { pullRef.current = pull; }, [pull]);

  const doReload = () => {
    try {
      window.location.reload();
    } catch {
      setRefreshing(false);
      setPull(0);
    }
  };

  const dismissOffline = () => {
    if (onlineListener.current) {
      window.removeEventListener("online", onlineListener.current);
      onlineListener.current = null;
    }
    setOffline(false);
    setRefreshing(false);
    setPull(0);
  };

  const retryNow = () => {
    if (navigator.onLine) {
      dismissOffline();
      setRefreshing(true);
      doReload();
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!isTouch) return;

    const prevOverscroll = document.documentElement.style.overscrollBehaviorY;
    document.documentElement.style.overscrollBehaviorY = "contain";

    const reset = () => {
      active.current = false;
      decided.current = false;
      startY.current = null;
      startX.current = null;
      setPull(0);
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return reset();
      if (getScrollTop() > 0) return;
      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      active.current = true;
      decided.current = false;
    };

    const onMove = (e: TouchEvent) => {
      if (!active.current || startY.current == null || startX.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      const dx = e.touches[0].clientX - startX.current;
      const d = decideGesture({ dy, dx, scrollTop: getScrollTop(), decided: decided.current });
      if (d.kind === "cancel") return reset();
      if (d.kind === "ignore") return;
      decided.current = true;
      setPull(d.pull);
      if (e.cancelable) e.preventDefault();
    };

    const onEnd = () => {
      if (!active.current) return reset();
      const trigger = shouldTriggerRefresh(pullRef.current, decided.current);
      active.current = false;
      decided.current = false;
      startY.current = null;
      startX.current = null;

      if (!trigger) {
        setPull(0);
        return;
      }

      setRefreshing(true);
      setPull(P2R_THRESHOLD);

      if (navigator.onLine === false) {
        // Offline: preserve cached data — no hard reload. Wait for `online`,
        // then reload; user can also tap Retry / Dismiss.
        setOffline(true);
        const listener = () => {
          if (onlineListener.current) {
            window.removeEventListener("online", onlineListener.current);
            onlineListener.current = null;
          }
          setOffline(false);
          doReload();
        };
        onlineListener.current = listener;
        window.addEventListener("online", listener);
      } else {
        window.setTimeout(doReload, 150);
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
      if (onlineListener.current) {
        window.removeEventListener("online", onlineListener.current);
        onlineListener.current = null;
      }
      document.documentElement.style.overscrollBehaviorY = prevOverscroll;
    };
  }, []);

  if (pull <= 0 && !refreshing && !offline) return null;
  const progress = Math.min(1, pull / P2R_THRESHOLD);

  return (
    <div
      className="fixed inset-x-0 top-0 z-[100] flex justify-center"
      style={{
        transform: `translateY(${Math.max(pull, refreshing ? P2R_THRESHOLD : 0) - 40}px)`,
        transition: refreshing || offline ? "transform 200ms ease" : "none",
        pointerEvents: offline ? "auto" : "none",
      }}
    >
      {offline ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-full bg-background/95 px-3 py-2 shadow-lg ring-1 ring-destructive/40 backdrop-blur"
        >
          <WifiOff className="h-4 w-4 text-destructive" />
          <span className="text-xs font-medium text-destructive">
            নেটওয়ার্ক নেই / Offline
          </span>
          <button
            type="button"
            onClick={retryNow}
            className="ml-1 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm hover:opacity-90"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
          <button
            type="button"
            onClick={dismissOffline}
            aria-label="Dismiss"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div
          role="status"
          aria-live="polite"
          aria-label={refreshing ? "Refreshing" : "Pull to refresh"}
          className="pointer-events-none flex items-center gap-2 rounded-full bg-background/95 px-3 py-2 shadow-lg ring-1 ring-border backdrop-blur"
        >
          {refreshing || progress >= 1 ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-xs font-medium text-muted-foreground">
                {refreshing ? "রিফ্রেশ হচ্ছে…" : "ছেড়ে দিন / Release"}
              </span>
            </>
          ) : (
            <>
              <ArrowDown
                className="h-5 w-5 text-primary transition-transform"
                style={{ transform: `rotate(${progress * 180}deg)`, opacity: 0.4 + progress * 0.6 }}
              />
              <span className="text-xs font-medium text-muted-foreground">
                টেনে রিফ্রেশ / Pull
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
