import type { Asset, Draft, Take } from "../contracts";
export type QualityIssue = {
  code: string;
  message: string;
  sceneId?: string;
  blocking: boolean;
};
export function inspectFilm(
  draft: Draft,
  assets: Asset[],
  takes: Take[] = [],
): QualityIssue[] {
  const issues: QualityIssue[] = [],
    byId = new Map(assets.map((a) => [a.id, a])),
    total = draft.shots.reduce((n, s) => n + s.duration, 0);
  const add = (
    code: string,
    message: string,
    blocking = false,
    sceneId?: string,
  ) => issues.push({ code, message, blocking, sceneId });
  if (!draft.shots.length)
    add("empty", "Create your first cut in Story.", true);
  if (
    draft.objective === "demonstration" &&
    !draft.shots.some(
      (s) =>
        s.template !== "endcard" &&
        byId.get(s.assetId || "")?.kind === "video" &&
        s.mode !== "generated-video",
    )
  )
    add(
      "missing-workflow",
      "Add real product workflow footage with its result, or choose a teaser in Brief.",
      true,
    );
  for (const s of draft.shots) {
    const source = byId.get(s.assetId || ""),
      take = takes.find((t) => t.id === s.selectedTakeId),
      generated = take && byId.get(take.assetId),
      video = s.mode === "generated-video" ? generated : source;
    if (s.template !== "endcard" && !source)
      add("missing-source", `Choose a source for “${s.title}”.`, true, s.id);
    for (const id of [s.assetId, s.secondaryAssetId]) {
      const a = byId.get(id || "");
      if (a?.metadata.privacyPending || a?.metadata.supersededBy)
        add(
          "privacy",
          `Replace the original in “${s.title}” with its reviewed safe copy.`,
          true,
          s.id,
        );
    }
    if (s.caption.length > s.duration * 18)
      add(
        "reading-time",
        `“${s.title}” needs more reading time or a shorter caption.`,
        false,
        s.id,
      );
    if (
      s.template !== "endcard" &&
      video?.kind === "video" &&
      s.trimStart + s.duration * s.playbackRate > (video.duration || 0) + 1 / 30
    )
      add("trim", `“${s.title}” runs beyond its recording.`, true, s.id);
    const narration = byId.get(s.narrationAssetId || "");
    if (narration && (narration.duration || 0) > s.duration + 1 / 30)
      add(
        "speech-cutoff",
        `Narration is longer than “${s.title}” and would be cut off. Lengthen the scene or shorten the recording.`,
        true,
        s.id,
      );
    if (s.speechCues.some((c) => c.end > s.duration + 0.05))
      add(
        "caption-cutoff",
        `Speech captions run beyond “${s.title}”.`,
        true,
        s.id,
      );
    if (s.mode === "generated-video" && (s.action || s.outcome))
      add(
        "synthetic-ui",
        `Use exact UI or a hybrid background for “${s.title}”; generated footage cannot stand in for the demonstrated action.`,
        true,
        s.id,
      );
    if (s.speechCues.length && !s.narrationAssetId)
      add(
        "orphan-captions",
        `“${s.title}” has speech captions without a recording.`,
        true,
        s.id,
      );
  }
  for (const c of draft.soundCues) {
    const a = byId.get(c.assetId);
    if (
      !a ||
      a.kind !== "audio" ||
      c.trimStart + c.duration > (a.duration || 0) + 0.05
    )
      add("sound-trim", "A sound cue extends beyond its audio source.", true);
    if (c.at + c.duration > total + 0.05)
      add(
        "sound-ending",
        "A sound cue extends beyond the film. Adjust its timing or duration.",
        true,
      );
  }
  if (
    draft.shots.length &&
    Math.abs(total - draft.targetSeconds) > draft.targetSeconds * 0.25
  )
    add(
      "target-length",
      `The film is ${total.toFixed(1)}s; the brief requests ${draft.targetSeconds}s.`,
    );
  return issues;
}
