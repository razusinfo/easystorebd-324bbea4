import * as React from "react";

const DESKTOP_BREAKPOINT = 1024; // lg
const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile|BlackBerry/i;

export type DeviceMode = "mobile" | "desktop";

function detect(): DeviceMode {
  if (typeof window === "undefined") return "desktop";
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as any).standalone === true;
  const ua = window.navigator.userAgent || "";
  const isMobileUA = MOBILE_UA.test(ua);
  const narrow = window.innerWidth < DESKTOP_BREAKPOINT;
  return standalone || isMobileUA || narrow ? "mobile" : "desktop";
}

export function useDeviceMode(): DeviceMode {
  const [mode, setMode] = React.useState<DeviceMode>(() => detect());

  React.useEffect(() => {
    const update = () => setMode(detect());
    update();
    window.addEventListener("resize", update);
    const mql = window.matchMedia("(display-mode: standalone)");
    mql.addEventListener?.("change", update);
    return () => {
      window.removeEventListener("resize", update);
      mql.removeEventListener?.("change", update);
    };
  }, []);

  return mode;
}

export function useIsMobileMode() {
  return useDeviceMode() === "mobile";
}
