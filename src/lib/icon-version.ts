/**
 * Bump this when you replace the PWA icon set or favicon in /public.
 * Appended to <link rel="icon">, <link rel="apple-touch-icon">, and
 * manifest icon URLs as a `?v=` query so already-installed apps and
 * cached browsers pick up the new artwork without a reinstall.
 *
 * The admin panel also bumps `site_settings.asset_version` at runtime for
 * uploaded logos — this constant is the build-time floor for the bundled
 * default artwork in /public.
 */
export const ICON_VERSION = 2;
