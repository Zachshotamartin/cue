import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  cancelRender,
  continueRender,
  delayRender,
  Sequence,
  staticFile,
  useVideoConfig,
} from "remotion";
import { musicGain } from "./captions";
import { SceneTransition } from "./SceneTransition";
import { SoundCue } from "./SoundCue";

export function Film(props: FilmProps) {
  const fontUrl = props.fontUrl || staticFile("brand/manrope.woff2");
  const [fontHandle] = useState(() => delayRender("Loading the film typeface"));
  useEffect(() => {
    const face = new FontFace("Manrope", `url(${JSON.stringify(fontUrl)})`, {
      weight: "200 800",
    });
    face
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        continueRender(fontHandle);
      })
      .catch((error) => cancelRender(error));
    return () => {
      document.fonts.delete(face);
    };
  }, [fontUrl, fontHandle]);

  const { fps } = useVideoConfig();
  let at = 0;
  const windows = props.draft.shots.map((s) => {
    const start = at;
    at += Math.round(s.duration * fps);
    return { s, start, end: at };
  });
  return (
    <AbsoluteFill style={{ backgroundColor: props.draft.brand.background }}>
      {props.fontUrl && (
        <style>{`@font-face{font-family:Manrope;src:url(${JSON.stringify(props.fontUrl)}) format('woff2');font-weight:200 800;font-display:block}`}</style>
      )}
      {windows.map(({ s, start, end }, index) => (
        <Sequence key={s.id} from={start} durationInFrames={end - start}>
          <SceneTransition
            {...props}
            shot={s}
            previous={props.draft.shots[index - 1]}
          />
        </Sequence>
      ))}
      {props.draft.soundCues.map(
        (cue) =>
          props.urls[cue.assetId] && (
            <Sequence
              key={cue.id}
              from={Math.round(cue.at * fps)}
              durationInFrames={Math.max(1, Math.round(cue.duration * fps))}
            >
              <SoundCue cue={cue} url={props.urls[cue.assetId]} />
            </Sequence>
          ),
      )}
      {props.draft.musicAssetId && props.urls[props.draft.musicAssetId] && (
        <Audio
          src={props.urls[props.draft.musicAssetId]}
          loop
          volume={(f) => {
            return (
              props.draft.musicVolume *
              musicGain(
                f / fps,
                at / fps,
                windows.map((w) => ({
                  start: w.start / fps,
                  end: Math.min(
                    w.end / fps,
                    w.start / fps +
                      (props.assets.find((a) => a.id === w.s.narrationAssetId)
                        ?.duration || 0),
                  ),
                  enabled: !!w.s.narrationAssetId,
                })),
              )
            );
          }}
        />
      )}
    </AbsoluteFill>
  );
}

import type { FilmProps } from "./types";
export type { FilmProps } from "./types";
