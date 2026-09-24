import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Shot } from "../contracts";
import type { FilmProps } from "./types";
import { SpeechCaptions } from "./SpeechCaptions";
import { SceneEmphasis } from "./SceneEmphasis";
import { Visual } from "./Visual";
export function Scene({
  shot,
  draft,
  assets,
  takes,
  urls,
}: FilmProps & { shot: Shot }) {
  const frame = useCurrentFrame(),
    { fps, width, height } = useVideoConfig();
  const total = Math.round(shot.duration * fps),
    p = Math.max(0, Math.min(1, frame / Math.max(1, total - 1))),
    ease = p * p * (3 - 2 * p);
  const portrait = height > width;
  const original = assets.find((a) => a.id === shot.assetId),
    take = takes.find((t) => t.id === shot.selectedTakeId),
    generated = assets.find((a) => a.id === take?.assetId);
  const source =
    shot.mode === "generated-video" && generated ? generated : original;
  const scale =
    shot.motion === "push"
      ? 1 + ease * 0.055
      : shot.motion === "pull"
        ? 1.055 - ease * 0.055
        : 1;
  const tx = shot.motion === "pan" ? interpolate(ease, [0, 1], [-2, 2]) : 0;
  const ty = shot.motion === "float" ? Math.sin(p * Math.PI) * -1.5 : 0;
  const opacity =
    shot.transition === "fade"
      ? interpolate(frame, [0, 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;
  const baseFont = width * (portrait ? 0.072 : 0.035);
  const start = shot.focalRect;
  const end = shot.focalEnd || start;
  const r = {
    x: interpolate(ease, [0, 1], [start.x, end.x]),
    y: interpolate(ease, [0, 1], [start.y, end.y]),
    width: interpolate(ease, [0, 1], [start.width, end.width]),
    height: interpolate(ease, [0, 1], [start.height, end.height]),
  };
  const cropped = r.width < 0.99 || r.height < 0.99;
  const ratio =
    source?.width && source?.height
      ? (source.width * r.width) / (source.height * r.height)
      : 16 / 9;
  const visualStyle: React.CSSProperties = cropped
    ? {
        position: "absolute",
        width: `${100 / r.width}%`,
        height: `${100 / r.height}%`,
        left: `${(-r.x * 100) / r.width}%`,
        top: `${(-r.y * 100) / r.height}%`,
        objectFit: "fill",
      }
    : { width: "100%", height: "100%", objectFit: "contain", display: "block" };
  const frameWidth =
      width * (shot.presentation === "full" ? 0.96 : portrait ? 0.88 : 0.82),
    frameHeight =
      height * (shot.presentation === "full" ? 0.78 : portrait ? 0.57 : 0.66),
    fitWidth = Math.min(frameWidth, frameHeight * ratio),
    fitHeight = fitWidth / ratio;
  const title = shot.caption || shot.title;
  const foreground = draft.brand.foreground;
  return (
    <AbsoluteFill
      style={{
        opacity,
        backgroundColor: shot.background,
        color: foreground,
        fontFamily: `${draft.brand.font}, Arial, sans-serif`,
        overflow: "hidden",
      }}
    >
      {shot.mode === "hybrid" && generated && (
        <AbsoluteFill style={{ opacity: 0.42 }}>
          <Visual
            asset={generated}
            url={urls[generated.id]}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            playbackRate={shot.playbackRate}
            trimStart={shot.trimStart}
            fps={fps}
          />
        </AbsoluteFill>
      )}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          padding: width * 0.045,
        }}
      >
        {shot.template === "endcard" ? (
          <>
            {draft.brand.logoAssetId && (
              <Img
                src={urls[draft.brand.logoAssetId]}
                style={{
                  width: width * 0.14,
                  maxHeight: height * 0.16,
                  objectFit: "contain",
                  marginBottom: height * 0.06,
                }}
              />
            )}
            <div
              style={{
                width: width * 0.07,
                height: Math.max(4, height * 0.009),
                background: draft.brand.accent,
                marginBottom: height * 0.06,
              }}
            />
            <div
              style={{
                fontSize: baseFont * 2,
                fontWeight: 750,
                letterSpacing: "-.055em",
                textAlign: "center",
                lineHeight: 1.06,
                maxWidth: "90%",
              }}
            >
              {draft.productName || draft.title}
            </div>
            <div
              style={{
                fontSize: baseFont * 0.68,
                marginTop: height * 0.04,
                opacity: 0.82,
                textAlign: "center",
                maxWidth: "86%",
                overflowWrap: "anywhere",
              }}
            >
              {title}
            </div>
            {draft.ctaUrl && (
              <div
                style={{
                  fontSize: baseFont * 0.5,
                  marginTop: height * 0.035,
                  textAlign: "center",
                  maxWidth: "86%",
                  overflowWrap: "anywhere",
                  color: draft.brand.accent,
                }}
              >
                {draft.ctaUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </div>
            )}
          </>
        ) : (
          <>
            <div
              style={{
                position: "absolute",
                left: width * 0.045,
                top: height * 0.045,
                display: "flex",
                gap: width * 0.013,
                alignItems: "center",
                fontSize: baseFont * 0.44,
                fontWeight: 650,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: baseFont * 0.22,
                  height: baseFont * 0.22,
                  background: draft.brand.accent,
                }}
              />
              {draft.productName || draft.title}
            </div>
            <div
              style={{
                fontSize: baseFont * (shot.template === "reveal" ? 1.3 : 1),
                fontWeight: 650,
                letterSpacing: "-.045em",
                lineHeight: 1.1,
                textAlign: "center",
                marginBottom: height * 0.045,
                maxWidth: "90%",
                transform: `translateY(${interpolate(ease, [0, 1], [8, 0])}px)`,
              }}
            >
              {title}
            </div>
            {shot.template === "comparison" && shot.secondaryAssetId ? (
              <div
                style={{
                  display: "flex",
                  gap: width * 0.018,
                  width: width * 0.86,
                  height: frameHeight,
                  flexDirection: portrait ? "column" : "row",
                }}
              >
                {[
                  source,
                  assets.find((a) => a.id === shot.secondaryAssetId),
                ].map((a, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      minHeight: 0,
                      borderRadius: 12,
                      overflow: "hidden",
                      background: "#ffffff0a",
                    }}
                  >
                    <Visual
                      asset={a}
                      url={a && urls[a.id]}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                      }}
                      playbackRate={shot.playbackRate}
                      trimStart={shot.trimStart}
                      fps={fps}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  width: fitWidth,
                  height: fitHeight,
                  position: "relative",
                  overflow: "hidden",
                  borderRadius:
                    shot.template === "atmosphere" ? 0 : width * 0.009,
                  transform: `perspective(${width}px) translate(${tx}%,${ty}%) scale(${scale}) ${shot.template === "reveal" ? `rotateY(${interpolate(ease, [0, 1], [-4, 0])}deg)` : ""}`,
                  boxShadow:
                    shot.template === "atmosphere"
                      ? undefined
                      : "0 25px 70px #00000028",
                  background: "#ffffff06",
                }}
              >
                <Visual
                  volume={
                    shot.mode === "generated-video" ? 0 : shot.sourceAudioVolume
                  }
                  asset={source}
                  url={source && urls[source.id]}
                  style={visualStyle}
                  playbackRate={shot.playbackRate}
                  trimStart={shot.trimStart}
                  fps={fps}
                />
                <SceneEmphasis
                  shot={shot}
                  accent={draft.brand.accent}
                  crop={r}
                />
              </div>
            )}
          </>
        )}
      </AbsoluteFill>
      <SpeechCaptions cues={shot.speechCues} />
      {shot.narrationAssetId && urls[shot.narrationAssetId] && (
        <Audio src={urls[shot.narrationAssetId]} volume={0.85} />
      )}
    </AbsoluteFill>
  );
}
