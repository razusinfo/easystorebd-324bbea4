import defaultLogo from "@/assets/eazystore-logo.png.asset.json";
import { useSiteSettings, useSignedSiteAsset } from "@/lib/site-settings";
import { useTheme } from "@/lib/theme";

type Variant = "auto" | "light" | "dark";

interface BrandLogoProps {
  variant?: Variant;
  className?: string;
  alt?: string;
}

/**
 * Renders the site brand logo. Uses:
 *   - dark-mode variant when the resolved theme is dark and one is set
 *   - the main uploaded logo otherwise
 *   - the bundled EasyStore default as final fallback
 *
 * Consumers can force a variant via the `variant` prop (useful on splash
 * screens or fixed-color surfaces).
 */
export function BrandLogo({ variant = "auto", className, alt = "Brand logo" }: BrandLogoProps) {
  const { theme } = useTheme();
  const settings = useSiteSettings();

  const wantDark =
    variant === "dark" || (variant === "auto" && theme === "dark");


  const darkPath = settings.data?.logo_url_dark ?? null;
  const lightPath = settings.data?.logo_url ?? null;
  const path = wantDark ? (darkPath ?? lightPath) : (lightPath ?? darkPath);

  const signed = useSignedSiteAsset(path);
  const src = signed.data ?? defaultLogo.url;

  return <img src={src} alt={alt} className={className} />;
}
