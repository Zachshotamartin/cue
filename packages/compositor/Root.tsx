import { Composition } from "remotion";
import { defaultDraft, dimensions, durationFrames } from "../contracts";
import { Film } from "./Film";
const defaults = {
  draft: defaultDraft("Cue"),
  assets: [],
  takes: [],
  urls: {},
};
export function Root() {
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
