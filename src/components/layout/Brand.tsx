type BrandProps = {
  className?: string;
  compact?: boolean;
};

export default function Brand({ className = "", compact = false }: BrandProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`.trim()}>
      {/* Inline V-slash — uses currentColor so it flips with the theme */}
      <svg
        width={compact ? 28 : 34}
        height={compact ? 28 : 34}
        viewBox="0 0 128 128"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="brand-logo-fill flex-shrink-0"
        aria-hidden="true"
      >
        <path d="M18 10 L54 110 L64 90 L36 10 Z" fill="currentColor" />
        <path d="M110 10 L74 110 L64 90 L92 10 Z" fill="currentColor" />
        <path d="M80 8 L44 122" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      </svg>

      <div>
        <div
          className="display-font font-bold theme-text-strong leading-none"
          style={{ fontSize: compact ? "1.1rem" : "1.25rem", letterSpacing: "-0.02em" }}
        >
          VoidLAB
        </div>
        {!compact && (
          <div className="text-xs theme-muted" style={{ letterSpacing: "0.04em" }}>
            by Voxion Labs
          </div>
        )}
      </div>
    </div>
  );
}
