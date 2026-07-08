import { useEffect, useRef, useState } from "react";
import { Loader2, ArrowDown } from "lucide-react";

const THRESHOLD = 70;
const MAX_PULL = 120;

/** Global mobile pull-to-refresh: pull down from top to reload the page. */
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const active = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Only enable on touch devices / narrow screens.
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!isTouch) return;

    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
      active.current = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!active.current || startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || window.scrollY > 0) {
        setPull(0);
        return;
      }
      const damped = Math.min(MAX_PULL, dy * 0.5);
      setPull(damped);
      if (dy > 10 && e.cancelable) e.preventDefault();
    };
    const onEnd = () => {
      if (!active.current) return;
      active.current = false;
      startY.current = null;
      if (pullRef.current >= THRESHOLD) {
        setRefreshing(true);
        setPull(THRESHOLD);
        setTimeout(() => window.location.reload(), 150);
      } else {
        setPull(0);
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
    };
  }, []);

  // Keep latest pull value accessible inside the touchend handler.
  const pullRef = useRef(0);
  useEffect(() => { pullRef.current = pull; }, [pull]);

  if (pull <= 0 && !refreshing) return null;
  const progress = Math.min(1, pull / THRESHOLD);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center"
      style={{ transform: `translateY(${pull - 40}px)`, transition: refreshing ? "transform 200ms ease" : "none" }}
      aria-hidden
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background/95 shadow-lg ring-1 ring-border backdrop-blur">
        {refreshing || progress >= 1 ? (
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
