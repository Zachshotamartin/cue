import React from "react";
import { Composition, registerRoot } from "remotion";
import { Film } from "./Film";
import { defaultDraft, dimensions, durationFrames } from "../contracts";
const defaults = {
  draft: defaultDraft("Cue"),
  assets: [],
  takes: [],
  urls: {},
};
function Root() {
  return (
    <Composition
      id="CueFilm"
      component={Film}
      defaultProps={defaults}
      durationInFrames={150}
      fps={30}
      width={1920}
      height={1080}
      calculateMetadata={({ props }) => ({
        ...dimensions(props.draft.format),
        durationInFrames: durationFrames(props.draft),
        props,
      })}
    />
  );
}
registerRoot(Root);
