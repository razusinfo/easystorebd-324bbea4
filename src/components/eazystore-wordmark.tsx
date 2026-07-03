/**
 * Premium serif wordmark for "EazyStore".
 * Coded as HTML text (not an image) using Playfair Display.
 * Colors follow the same rule as the Lovable mark:
 *   E   = #B3002D (deep red)
 *   azy = #000000 (black)
 *   S   = #B3002D (deep red)
 *   tore= #000000 (black)
 */
export function EazyStoreWordmark({
  className = "",
  italic = false,
}: {
  className?: string;
  italic?: boolean;
}) {
  return (
    <span
      aria-label="EazyStore"
      className={`inline-block select-none font-black leading-none tracking-[0.01em] ${className}`}
      style={{
        fontFamily: '"Playfair Display", Georgia, serif',
        fontStyle: italic ? "italic" : "normal",
      }}
    >
      <span style={{ color: "#B3002D" }}>E</span>
      <span style={{ color: "#000000" }}>azy</span>
      <span style={{ color: "#B3002D" }}>S</span>
      <span style={{ color: "#000000" }}>tore</span>
    </span>
  );
}
