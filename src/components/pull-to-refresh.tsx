import { useEffect, useRef, useState } from "react";
import { Loader2, ArrowDown, WifiOff } from "lucide-react";

const THRESHOLD = 70;
const MAX_PULL = 120;
const MIN_START_DELTA = 8;   // ignore accidental taps
const HORIZONTAL_TOLERANCE = 1.2; // dy must exceed |dx| * this

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
  const decided = useRef(false); // once true, this gesture is P2R
  const pullRef = useRef(0);

  useEffect(() => { pullRef.current = pull; }, [pull]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!isTouch) return;

    // iOS Safari rubber-bands the whole page; contain overscroll so our
    // gesture is the only one that fires at the top.
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

      // Cancel if page scrolled or user moved up.
      if (dy <= 0 || getScrollTop() > 0) return reset();

      // Wait until gesture is clearly vertical & past a minimum threshold.
      if (!decided.current) {
        if (Math.abs(dy) < MIN_START_DELTA) return;
        if (Math.abs(dy) < Math.abs(dx) * HORIZONTAL_TOLERANCE) return reset();
        decided.current = true;
      }

      const damped = Math.min(MAX_PULL, dy * 0.5);
      setPull(damped);
      if (e.cancelable) e.preventDefault();
    };

    const onEnd = () => {
      if (!active.current) return reset();
      const shouldRefresh = decided.current && pullRef.current >= THRESHOLD;
      active.current = false;
      decided.current = false;
      startY.current = null;
      startX.current = null;

      if (!shouldRefresh) {
        setPull(0);
        return;
      }

      setRefreshing(true);
      setPull(THRESHOLD);

      const doReload = () => {
        try {
          window.location.reload();
        } catch {
          setRefreshing(false);
          setPull(0);
        }
      };

      if (navigator.onLine === false) {
        // Offline: don't hard-reload (would wipe SPA state and likely fail).
        // Show offline hint and retry once connection returns.
        setOffline(true);
        const onOnline = () => {
          window.removeEventListener("online", onOnline);
          setOffline(false);
          doReload();
        };
        window.addEventListener("online", onOnline);
        // Auto-dismiss the offline hint after a few seconds if still offline.
        window.setTimeout(() => {
          if (!navigator.onLine) {
            window.removeEventListener("online", onOnline);
            setOffline(false);
            setRefreshing(false);
            setPull(0);
          }
        }, 3000);
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
      document.documentElement.style.overscrollBehaviorY = prevOverscroll;
    };
  }, []);

  if (pull <= 0 && !refreshing && !offline) return null;
  const progress = Math.min(1, pull / THRESHOLD);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center"
      style={{
        transform: `translateY(${Math.max(pull, refreshing ? THRESHOLD : 0) - 40}px)`,
        transition: refreshing || offline ? "transform 200ms ease" : "none",
      }}
      aria-hidden
    >
      <div className="flex items-center gap-2 rounded-full bg-background/95 px-3 py-2 shadow-lg ring-1 ring-border backdrop-blur">
        {offline ? (
          <>
            <WifiOff className="h-4 w-4 text-destructive" />
            <span className="text-xs font-medium text-destructive">Offline — waiting…</span>
          </>
        ) : refreshing || progress >= 1 ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <ArrowDown
            className="h-5 w-5 text-primary transition-transform"
            style={{ transform: `rotate(${progress * 180}deg)`, opacity: 0.4 + progress * 0.6 }}
          />
        )}
      </div>
    </div>
  );
}
