import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Whether this reader asked for less movement.
 *
 * The CSS in `styles.css` answers the same question for everything it draws;
 * this is for the motion CSS cannot reach — Recharts animates its own marks in
 * JavaScript and honours no media query of its own, so a chart would keep
 * growing its bars out of the axis for a reader who turned movement off.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => globalThis.matchMedia?.(QUERY).matches ?? false,
  );
  useEffect(() => {
    const media = globalThis.matchMedia?.(QUERY);
    if (!media) return;
    const onChange = () => setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
