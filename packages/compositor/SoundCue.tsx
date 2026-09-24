import { Audio, useCurrentFrame, useVideoConfig } from "remotion";
import type { Draft } from "../contracts";
export function SoundCue({
  cue,
  url,
}: {
  cue: Draft["soundCues"][number];
  url: string;
}) {
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig();
  const fade = Math.max(1, cue.fade * fps),
    end = cue.duration * fps;
  return (
    <Audio
      src={url}
      startFrom={Math.round(cue.trimStart * fps)}
      volume={
        cue.volume *
        Math.max(0, Math.min(1, frame / fade, (end - frame) / fade))
      }
    />
  );
}
