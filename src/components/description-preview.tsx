import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

/**
 * Renders a live preview of markdown-ish text used by the Product Description
 * editor. Uses `marked` for parsing and DOMPurify to strip any unsafe HTML
 * (while allowing the <u> tags the toolbar inserts for underline).
 */
export function DescriptionPreview({ markdown }: { markdown: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(markdown || "", { async: false, breaks: true }) as string;
    return DOMPurify.sanitize(raw, { ADD_TAGS: ["u"] });
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
