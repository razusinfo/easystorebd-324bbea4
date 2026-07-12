import { useEffect } from "react";

/**
 * Global desktop keyboard shortcuts:
 *   /            → focus first visible search input (unless already typing)
 *   Ctrl/Cmd+K   → same as "/"
 *   Ctrl/Cmd+S   → click nearest "Save"/"সেভ" button in the active form
 *   Esc          → blur focused input
 * All handlers no-op when the user is already typing into an editable field
 * (except Escape and Ctrl+S, which are meaningful there).
 */
export function KeyboardShortcuts() {
  useEffect(() => {
    function isEditable(el: EventTarget | null): el is HTMLElement {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      );
    }

    function focusSearch() {
      const el =
        (document.querySelector<HTMLInputElement>(
          'input[type="search"]:not([disabled])'
        ) ??
          document.querySelector<HTMLInputElement>(
            'input[placeholder*="সার্চ" i]:not([disabled]), input[placeholder*="search" i]:not([disabled]), input[aria-label*="search" i]:not([disabled])'
          ));
      if (el) {
        el.focus();
        el.select?.();
        return true;
      }
      return false;
    }

    function clickSave() {
      const buttons = Array.from(
        document.querySelectorAll<HTMLButtonElement>("button:not([disabled])")
      );
      const match = buttons.find((b) => {
        const t = (b.textContent || "").trim().toLowerCase();
        return (
          t === "save" ||
          t === "সেভ" ||
          t === "সংরক্ষণ" ||
          t === "সংরক্ষণ করুন" ||
          t.startsWith("save ") ||
          t.startsWith("সেভ ")
        );
      });
      if (match) {
        match.click();
        return true;
      }
      // Fallback: submit the form containing the active element.
      const form =
        (document.activeElement as HTMLElement | null)?.closest("form") ??
        document.querySelector("form");
      if (form) {
        form.requestSubmit?.();
        return true;
      }
      return false;
    }

    function onKey(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey;

      if (e.key === "Escape" && isEditable(document.activeElement)) {
        (document.activeElement as HTMLElement).blur();
        return;
      }

      if (ctrl && e.key.toLowerCase() === "s") {
        if (clickSave()) {
          e.preventDefault();
        }
        return;
      }

      if (isEditable(e.target)) return;

      if (e.key === "/" || (ctrl && e.key.toLowerCase() === "k")) {
        if (focusSearch()) e.preventDefault();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
