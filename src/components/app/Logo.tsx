/** Brand mark: a 2×2 grid of blocks in brand green, with the top-right block tinted. */
export function LogoMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#176B4D" />
      <rect x="6" y="6" width="9" height="9" rx="2" fill="#ffffff" />
      <rect x="17" y="6" width="9" height="9" rx="2" fill="#7BC8A0" />
      <rect x="6" y="17" width="9" height="9" rx="2" fill="#ffffff" />
      <rect x="17" y="17" width="9" height="9" rx="2" fill="#ffffff" />
    </svg>
  );
}
