type BrandProps = {
  className?: string;
  compact?: boolean;
};

export default function Brand({ className = "", compact = false }: BrandProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <div className={`${compact ? "h-8 w-8" : "h-10 w-10"} flex-shrink-0 flex items-center justify-center`}>
        {/* V-slash mark — fill inherits from theme-text-strong via currentColor */}
        <svg
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full brand-logo-fill"
        >
          <path d="M18 10 L54 110 L64 90 L36 10 Z" fill="currentColor" />
          <path d="M110 10 L74 110 L64 90 L92 10 Z" fill="currentColor" />
          <path d="M80 8 L44 122" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
        </svg>
      </div>
      <div>
        <div className="display-font text-2xl font-semibold theme-text-strong leading-none">VoidLAB</div>
        {!compact ? (
          <div className="text-xs uppercase tracking-[0.18em] theme-muted mt-0.5">Voxion Labs</div>
        ) : null}
      </div>
    </div>
  );
}
