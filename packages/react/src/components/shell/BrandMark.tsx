/**
 * The product's one drawn mark: a lens watching over a sweep. Drawn rather than
 * borrowed, and deliberately not a company logo: this is an internal tool's sign.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#14263d" stroke="#2c4566" />
      <circle cx="16" cy="16" r="9.5" stroke="#5cc2f5" strokeOpacity=".45" strokeWidth="1.5" />
      <path d="M16 16V6.5A9.5 9.5 0 0 1 25.2 13.7Z" fill="#f2a93b" fillOpacity=".85" />
      <circle cx="16" cy="16" r="4" fill="#5cc2f5" />
      <circle cx="14.7" cy="14.7" r="1.3" fill="#eaf8ff" />
    </svg>
  );
}
