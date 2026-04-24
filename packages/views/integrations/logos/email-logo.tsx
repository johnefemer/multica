// Generic email / envelope mark — polished SVG for the Email integration card.
// Uses currentColor so it inherits the parent text colour (white on coloured bg).
export function EmailLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Email"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Envelope body */}
      <rect x="2" y="4" width="20" height="16" rx="2" />
      {/* Fold lines forming the V */}
      <polyline points="2,4 12,13 22,4" />
    </svg>
  );
}
