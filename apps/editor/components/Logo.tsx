export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="wordmark" aria-label="Cue">
      <span className="cue-mark" aria-hidden="true">
        <i />
      </span>
      {!compact && <span>cue</span>}
    </span>
  );
}
