import { Freeze, useCurrentFrame, useVideoConfig } from "remotion";
import type { Shot } from "../contracts";
import type { FilmProps } from "./types";
import { Scene } from "./Scene";
export function SceneTransition(
  props: FilmProps & { shot: Shot; previous?: Shot },
) {
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig();
  return (
    <>
      {props.previous && props.shot.transition === "fade" && frame < 8 && (
        <Freeze frame={Math.round(props.previous.duration * fps) - 1}>
          <Scene
            {...props}
            shot={{
              ...props.previous,
              transition: "cut",
              narrationAssetId: null,
              sourceAudioVolume: 0,
              speechCues: [],
            }}
          />
        </Freeze>
      )}
      <Scene {...props} />
    </>
  );
}
