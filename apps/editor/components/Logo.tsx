export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      className={`wordmark${compact ? " is-compact" : ""}`}
      viewBox={compact ? "0 0 211 114" : "0 0 389 180"}
      role="img"
      aria-label="Cue"
    >
      <use href={`/brand/cue-logo.svg#${compact ? "mark" : "wordmark"}`} />
    </svg>
  );
}
