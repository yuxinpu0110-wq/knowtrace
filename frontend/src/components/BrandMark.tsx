export default function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-mark${compact ? ' compact' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 40 40" role="img">
        <path d="M8 27.5 17.2 18l5.3 5.2L31.5 13" />
        <circle cx="8" cy="27.5" r="2.6" />
        <circle cx="17.2" cy="18" r="2.6" />
        <circle cx="22.5" cy="23.2" r="2.6" />
        <circle cx="31.5" cy="13" r="3.1" className="brand-mark-accent" />
      </svg>
    </span>
  );
}
