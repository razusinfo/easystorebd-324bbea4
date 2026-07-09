import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

/**
 * Renders a live preview of the Product Description. The editor now emits
 * sanitized HTML (WYSIWYG). Legacy products may still contain markdown-only
 * strings, so we detect that shape and route through `marked` first.
 */
export function DescriptionPreview({ markdown }: { markdown: string }) {
  const html = useMemo(() => {
    const src = markdown || "";
    const looksLikeHtml = /<[a-z][\s\S]*>/i.test(src);
    const raw = looksLikeHtml
      ? src
      : (marked.parse(src, { async: false, breaks: true }) as string);
    return DOMPurify.sanitize(raw, {
      ADD_TAGS: ["u"],
      ADD_ATTR: ["target", "rel"],
    });
  }, [markdown]);

  if (!markdown.trim()) {
    return (
      <div className="rounded-md border border-dashed border-input bg-muted/20 p-4 text-xs text-foreground/60">
        Preview will appear here as you type.
      </div>
    );
  }

  return (
    <div
      data-testid="description-preview"
      className="prose prose-sm max-w-none rounded-md border border-input bg-background p-3 dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
