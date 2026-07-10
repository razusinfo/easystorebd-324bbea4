import { marked } from "marked";
import DOMPurify from "dompurify";

/**
 * Converts a stored product description into sanitized HTML.
 * - If the value already contains HTML tags, sanitize as-is.
 * - Otherwise (legacy markdown or plain text), parse through `marked` first.
 */
export function descriptionToHtml(src: string | null | undefined): string {
  const value = src ?? "";
  if (!value.trim()) return "";
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(value);
  const raw = looksLikeHtml
    ? value
    : (marked.parse(value, { async: false, breaks: true }) as string);
  return DOMPurify.sanitize(raw, {
    ADD_TAGS: ["u"],
    ADD_ATTR: ["target", "rel"],
  });
}
