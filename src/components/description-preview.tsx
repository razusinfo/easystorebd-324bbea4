import { useMemo } from "react";
import { descriptionToHtml } from "@/lib/description-html";

/**
 * Renders a live preview of the Product Description. The editor now emits
 * sanitized HTML (WYSIWYG). Legacy products may still contain markdown-only
 * strings, so we route those through `marked` first via `descriptionToHtml`.
 */
export function DescriptionPreview({ markdown }: { markdown: string }) {
  const html = useMemo(() => descriptionToHtml(markdown), [markdown]);

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
