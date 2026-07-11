import { cn } from "@/lib/utils";

const FALLBACK_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#059669"/></linearGradient></defs><rect width="240" height="240" rx="48" fill="url(#g)"/><path d="M60 96l14-32a10 10 0 0 1 9-6h74a10 10 0 0 1 9 6l14 32" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><rect x="56" y="96" width="128" height="88" rx="10" fill="#fff"/><rect x="80" y="132" width="80" height="40" rx="6" fill="#059669"/></svg>',
  );

export type SplashFramePreset = "mobile" | "desktop";

export function SplashFrame({
  logoUrl,
  preset = "mobile",
  label,
  host,
  dark = false,
  loading = false,
  className,
}: {
  logoUrl: string | null;
  preset?: SplashFramePreset;
  label?: string;
  host?: string;
  dark?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const src = logoUrl ?? FALLBACK_SVG;
  const dims =
    preset === "mobile"
      ? "aspect-[9/16] max-w-[220px]"
      : "aspect-[16/10] max-w-[420px]";

  return (
    <div className={cn("w-full flex flex-col gap-2", className)}>
      {label && (
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </div>
      )}
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-2xl border shadow-sm",
          dims,
        )}
        style={{ background: dark ? "#0a0a0a" : "#ffffff" }}
      >
        <div className="absolute inset-0 grid place-items-center">
          <img
            src={src}
            alt="Splash preview"
            className={cn(
              "object-contain",
              preset === "mobile" ? "w-[42%]" : "w-[22%]",
              loading && "opacity-0 transition-opacity",
            )}
            style={{ aspectRatio: "1 / 1", borderRadius: 24 }}
          />
        </div>
        <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center gap-1.5">
          <div className="flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.2s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.1s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce" />
          </div>
          <div
            className="text-[10px] font-medium"
            style={{ color: dark ? "#a3a3a3" : "#525252" }}
          >
            লোড হচ্ছে…
          </div>
        </div>
      </div>
      {host && (
        <div className="text-[11px] text-muted-foreground font-mono truncate">
          {host}
        </div>
      )}
    </div>
  );
}
