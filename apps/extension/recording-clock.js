/** Times are active recorded time, excluding pauses; shared with deterministic tests. */
export class RecordingClock {
  constructor(now = () => performance.now()) {
    this.now = now;
    this.start = now();
    this.pausedAt = null;
    this.pausedTotal = 0;
  }
  elapsed() {
    return Math.max(
      0,
      ((this.pausedAt ?? this.now()) - this.start - this.pausedTotal) / 1000,
    );
  }
  pause() {
    if (this.pausedAt === null) this.pausedAt = this.now();
  }
  resume() {
    if (this.pausedAt !== null) {
      this.pausedTotal += this.now() - this.pausedAt;
      this.pausedAt = null;
    }
  }
}
