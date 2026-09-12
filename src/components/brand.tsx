export function CloseoutLogo({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={`closeout-logo ${className}`}>
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path
          d="M23 7H14a7 7 0 0 0-7 7v12a7 7 0 0 0 7 7h9"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M19 20h15m-6-6 6 6-6 6"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {!compact && (
        <span className="closeout-logo-word">
          closeout<span>.</span>
        </span>
      )}
    </span>
  );
}
