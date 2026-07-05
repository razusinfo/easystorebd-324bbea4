/**
 * Strict CSS hex color validator/sanitizer.
 *
 * Storefront templates inject the store owner's chosen accent color into a
 * `<style>` tag via `dangerouslySetInnerHTML`. Because `<style>` uses RAWTEXT
 * parsing, a value like `</style><img src=x onerror=alert(1)>` would break out
 * of the style context and execute script for every public shopper. To make
 * that impossible, every accent value MUST pass through `sanitizeHexColor()`
 * before being interpolated into CSS.
 */

const HEX_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function isValidHexColor(v: unknown): v is string {
  return typeof v === "string" && HEX_PATTERN.test(v.trim());
}

/**
 * Returns the input verbatim if it is a `#RGB`/`#RGBA`/`#RRGGBB`/`#RRGGBBAA`
 * hex color, otherwise returns `fallback` (default `#5B21B6`). Safe to embed
 * inside a CSS declaration value.
 */
export function sanitizeHexColor(v: unknown, fallback = "#5B21B6"): string {
  return isValidHexColor(v) ? v.trim() : fallback;
}
