import type { Shot } from "../contracts";

/** Keep source-time events attached to their actual recording moment after an edit. */
export function patchShot(shot: Shot, patch: Partial<Shot>): Shot {
  const next = { ...shot, ...patch };
  if (patch.assetId !== undefined && patch.assetId !== shot.assetId) {
    next.trimStart = patch.trimStart ?? 0;
    next.emphasis = patch.emphasis ?? [];
    next.evidenceIds =
      patch.evidenceIds ?? (next.assetId ? [next.assetId] : []);
  } else if (
    !patch.emphasis &&
    (patch.trimStart !== undefined ||
      patch.playbackRate !== undefined ||
      patch.duration !== undefined)
  ) {
    next.emphasis = shot.emphasis
      .map((e) => ({
        ...e,
        at:
          (shot.trimStart + e.at * shot.playbackRate - next.trimStart) /
          next.playbackRate,
        duration: (e.duration * shot.playbackRate) / next.playbackRate,
      }))
      .filter((e) => e.at >= 0 && e.at < next.duration)
      .map((e) => ({
        ...e,
        duration: Math.max(0.2, Math.min(10, e.duration, next.duration - e.at)),
      }));
  }
  return next;
}

export function splitShot(shot: Shot, at: number, id: string): [Shot, Shot] {
  if (
    at < 1 ||
    shot.duration - at < 1 ||
    shot.narrationAssetId ||
    shot.selectedTakeId
  )
    throw Error(
      "Split needs one second on each side and detached generated media.",
    );
  const end = shot.focalEnd || shot.focalRect,
    p = at / shot.duration,
    ease = p * p * (3 - 2 * p);
  const middle = {
    x: shot.focalRect.x + (end.x - shot.focalRect.x) * ease,
    y: shot.focalRect.y + (end.y - shot.focalRect.y) * ease,
    width: shot.focalRect.width + (end.width - shot.focalRect.width) * ease,
    height: shot.focalRect.height + (end.height - shot.focalRect.height) * ease,
  };
  return [
    patchShot(shot, { duration: at, focalEnd: middle }),
    patchShot(structuredClone(shot), {
      id,
      title: `${shot.title} · continued`.slice(0, 100),
      duration: shot.duration - at,
      trimStart: shot.trimStart + at * shot.playbackRate,
      focalRect: middle,
      transition: "cut",
      motion: "still",
      speechCues: [],
    }),
  ];
}
