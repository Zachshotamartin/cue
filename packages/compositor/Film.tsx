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
      {windows.map(({ s, start, end }) => (
        <Sequence key={s.id} from={start} durationInFrames={end - start}>
          <Scene {...props} shot={s} />
        </Sequence>
      ))}
      {props.draft.musicAssetId && props.urls[props.draft.musicAssetId] && (
        <Audio
          src={props.urls[props.draft.musicAssetId]}
          loop
          volume={(f) => {
            const speaking = windows.some(
              (w) => w.s.narrationAssetId && f >= w.start && f < w.end,
            );
            const edge = Math.min(1, f / 15, Math.max(0, (at - f) / 20));
            return props.draft.musicVolume * (speaking ? 0.28 : 1) * edge;
          }}
        />
      )}
    </AbsoluteFill>
  );
}

import { Scene } from "./Scene";
import type { FilmProps } from "./types";
export type { FilmProps } from "./types";
