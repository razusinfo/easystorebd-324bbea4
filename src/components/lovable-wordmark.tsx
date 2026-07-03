/**
 * Premium serif wordmark for "Lovable".
 * Coded as HTML text (not an image) using Playfair Display.
 * Colors: L = #B3002D, ova = #000, b = #B3002D, le = #000
 */
export function LovableWordmark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-label="Lovable"
      className={`inline-block select-none font-black leading-none tracking-[0.02em] text-[2rem] sm:text-[2.5rem] ${className}`}
      style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
    >
      <span style={{ color: "#B3002D" }}>L</span>
      <span style={{ color: "#000000" }}>ova</span>
      <span style={{ color: "#B3002D" }}>b</span>
      <span style={{ color: "#000000" }}>le</span>
    </span>
  );
}
