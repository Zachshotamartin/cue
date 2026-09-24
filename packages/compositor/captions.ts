import type { Draft } from "../contracts";
export function speechSrt(draft: Draft) {
  let offset = 0,
    index = 0;
  const time = (n: number) =>
    new Date(Math.round(n * 1000))
      .toISOString()
      .slice(11, 23)
      .replace(".", ",");
  return draft.shots
    .flatMap((shot) => {
      const cues = shot.speechCues
        .filter((c) => c.start < shot.duration && c.end > c.start)
        .map(
          (c) =>
            `${++index}\n${time(offset + c.start)} --> ${time(offset + Math.min(c.end, shot.duration))}\n${c.text.replace(/[\r\n]+/g, " ")}\n`,
        );
      offset += shot.duration;
      return cues;
    })
    .join("\n");
}
/** Smooth attack/release avoids audible volume steps around speech. */
export function musicGain(
  time: number,
  duration: number,
  windows: { start: number; end: number; enabled: boolean }[],
) {
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const speech = windows.reduce(
    (gain, w) =>
      !w.enabled || w.end <= w.start
        ? gain
        : Math.max(
            gain,
            Math.min(
              clamp((time - w.start + 0.15) / 0.15),
              clamp((w.end + 0.3 - time) / 0.3),
            ),
          ),
    0,
  );
  return (
    (1 - speech * 0.72) *
    Math.min(clamp(time / 0.5), clamp((duration - time) / 0.8))
  );
}
