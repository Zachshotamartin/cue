import React from "react";
import { Img, OffthreadVideo } from "remotion";
import type { Asset } from "../contracts";

export function Visual({
  asset,
  url,
  style,
  trimStart = 0,
  fps,
}: {
  asset?: Asset;
  url?: string;
  style: React.CSSProperties;
  trimStart?: number;
  fps: number;
}) {
  if (!asset || !url) return null;
  return asset.kind === "video" ? (
    <OffthreadVideo
      src={url}
      startFrom={Math.round(trimStart * fps)}
      muted
      style={style}
    />
  ) : (
    <Img src={url} style={style} />
  );
}
