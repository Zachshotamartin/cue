import React from "react";
import { Img, OffthreadVideo } from "remotion";
import type { Asset } from "../contracts";

export function Visual({
  asset,
  url,
  style,
  trimStart = 0,
  fps,
  playbackRate = 1,
  volume = 0,
}: {
  asset?: Asset;
  url?: string;
  style: React.CSSProperties;
  trimStart?: number;
  fps: number;
  playbackRate?: number;
  volume?: number;
}) {
  if (!asset || !url) return null;
  return asset.kind === "video" ? (
    <OffthreadVideo
      src={url}
      startFrom={Math.round(trimStart * fps)}
      playbackRate={playbackRate}
      muted={volume === 0}
      volume={volume}
      style={style}
    />
  ) : (
    <Img src={url} style={style} />
  );
}
