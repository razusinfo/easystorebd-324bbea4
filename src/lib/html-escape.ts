/**
 * Escape a user-controlled string for safe interpolation into HTML.
 *
 * Transactional emails and other server-rendered HTML must never interpolate
 * raw user input (customer names, product titles, reseller notes) directly:
 * an attacker could inject `<a href="https://evil/">Verify</a>` or
 * `<img onerror=...>` and phish recipients using our sending reputation.
 * Always wrap user-controlled values with `escapeHtml()` before embedding
 * them in `<td>`, `<p>`, `<li>`, attribute values, etc.
 */
export function escapeHtml(value: unknown): string {
  const s = value == null ? "" : String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
