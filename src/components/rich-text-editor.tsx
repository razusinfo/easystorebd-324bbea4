import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import {
  Bold, Eraser, ImageIcon, Italic, Link2,
  List, ListOrdered, Quote, Underline,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
};

const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "blockquote",
  "ul", "ol", "li", "h1", "h2", "h3", "h4", "a", "img", "span", "div",
];
const ALLOWED_ATTR = ["href", "src", "alt", "title", "target", "rel", "style"];

function sanitize(html: string) {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}

/**
 * Lightweight WYSIWYG editor built on contentEditable + document.execCommand.
 * - Stores sanitized HTML in `value` / emits via `onChange`.
 * - Toolbar buttons apply formatting to the current selection (or at cursor).
 * - Uncontrolled internal DOM to avoid caret-jump on every keystroke; syncs
 *   from `value` only when the incoming value diverges from what the user typed.
 */
export function RichTextEditor({ value, onChange, placeholder, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const lastEmitted = useRef<string>(value ?? "");
  const [isEmpty, setIsEmpty] = useState<boolean>(!value || !stripHtml(value).trim());

  // Sync incoming `value` into DOM only when it doesn't match what we last emitted.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const incoming = value ?? "";
    if (incoming === lastEmitted.current) return;
    el.innerHTML = sanitize(incoming);
    lastEmitted.current = incoming;
    setIsEmpty(!stripHtml(incoming).trim());
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const html = sanitize(el.innerHTML);
    lastEmitted.current = html;
    setIsEmpty(!stripHtml(html).trim());
    onChange(html);
  };

  const focusEditor = () => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement !== el) el.focus();
  };

  const exec = (command: string, arg?: string) => {
    focusEditor();
    // execCommand is deprecated but remains the most reliable cross-browser
    // way to implement a small WYSIWYG without pulling in a heavy editor lib.
    document.execCommand(command, false, arg);
    emit();
  };

  const applyBlock = (tag: "P" | "H1" | "H2" | "H3" | "BLOCKQUOTE") => {
    focusEditor();
    // formatBlock needs the tag wrapped in <...> in some browsers.
    document.execCommand("formatBlock", false, `<${tag}>`);
    emit();
  };

  const insertLink = () => {
    const url = window.prompt("Enter URL (https://…)");
    if (!url) return;
    const safe = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    exec("createLink", safe);
    // Force target=_blank on the newly created link.
    const el = ref.current;
    if (el) {
      el.querySelectorAll("a[href]").forEach((a) => {
        (a as HTMLAnchorElement).target = "_blank";
        (a as HTMLAnchorElement).rel = "noopener noreferrer";
      });
      emit();
    }
  };

  const insertImage = () => {
    const url = window.prompt("Enter image URL");
    if (!url) return;
    exec("insertImage", url);
  };

  const clearFormat = () => {
    focusEditor();
    document.execCommand("removeFormat");
    document.execCommand("unlink");
    emit();
  };

  return (
    <div className={cn("rounded-md border border-input bg-background", className)}>
      <div
        className="flex flex-wrap items-center gap-0.5 border-b border-input px-2 py-1.5 text-foreground/70"
        // Prevent toolbar mousedown from stealing selection from the editor.
        onMouseDown={(e) => e.preventDefault()}
      >
        <select
          className="mr-1 h-7 rounded-sm border border-input bg-background px-2 text-xs"
          onChange={(e) => {
            const v = e.target.value;
            applyBlock(v === "p" ? "P" : (v.toUpperCase() as "H1" | "H2" | "H3"));
            e.currentTarget.value = "p";
          }}
          defaultValue="p"
        >
          <option value="p">Normal</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
        <Btn title="Bold" onClick={() => exec("bold")}><Bold className="h-3.5 w-3.5" /></Btn>
        <Btn title="Italic" onClick={() => exec("italic")}><Italic className="h-3.5 w-3.5" /></Btn>
        <Btn title="Underline" onClick={() => exec("underline")}><Underline className="h-3.5 w-3.5" /></Btn>
        <Btn title="Strikethrough" onClick={() => exec("strikeThrough")}>
          <span className="text-xs font-bold line-through">S</span>
        </Btn>
        <Btn title="Quote" onClick={() => applyBlock("BLOCKQUOTE")}>
          <Quote className="h-3.5 w-3.5" />
        </Btn>
        <span className="mx-1 h-4 w-px bg-border" />
        <Btn title="Bulleted list" onClick={() => exec("insertUnorderedList")}>
          <List className="h-3.5 w-3.5" />
        </Btn>
        <Btn title="Numbered list" onClick={() => exec("insertOrderedList")}>
          <ListOrdered className="h-3.5 w-3.5" />
        </Btn>
        <span className="mx-1 h-4 w-px bg-border" />
        <Btn title="Insert link" onClick={insertLink}><Link2 className="h-3.5 w-3.5" /></Btn>
        <Btn title="Insert image" onClick={insertImage}><ImageIcon className="h-3.5 w-3.5" /></Btn>
        <Btn title="Clear formatting" onClick={clearFormat}><Eraser className="h-3.5 w-3.5" /></Btn>
      </div>
      <div className="relative">
        <div
          ref={ref}
          role="textbox"
          aria-multiline="true"
          aria-label="Product description"
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          onPaste={(e) => {
            // Prefer plain text on paste to avoid injecting scripts/styles.
            e.preventDefault();
            const text = e.clipboardData.getData("text/plain");
            document.execCommand("insertText", false, text);
            emit();
          }}
          className="prose prose-sm max-w-none min-h-[160px] px-3 py-2 text-sm focus:outline-none dark:prose-invert [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_a]:text-primary [&_a]:underline"
        />
        {isEmpty && (
          <div
            className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground"
            aria-hidden
          >
            {placeholder || "Write something…"}
          </div>
        )}
      </div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded-sm hover:bg-foreground/10 active:bg-foreground/20"
    >
      {children}
    </button>
  );
}

function stripHtml(html: string): string {
  if (!html) return "";
  if (typeof document === "undefined") return html.replace(/<[^>]*>/g, "");
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || "";
}
