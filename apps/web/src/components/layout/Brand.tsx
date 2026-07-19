type BrandProps = {
  className?: string;
  compact?: boolean;
};

export default function Brand({ className = "", compact = false }: BrandProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <div className={`${compact ? "h-9 w-9" : "h-10 w-10"} flex items-center justify-center overflow-hidden`}>
        <img src="/icon.svg" alt="VoidLAB logo" className="h-full w-full object-contain" />
      </div>
      <div>
        <div className="display-font text-2xl font-semibold theme-text-strong">VoidLAB</div>
        {!compact ? <div className="text-xs uppercase tracking-[0.18em] theme-muted">Voxion Labs</div> : null}
      </div>
    </div>
  );
}
