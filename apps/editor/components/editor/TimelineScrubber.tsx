"use client";
import { useEffect, useState, type CSSProperties } from "react";
import type { CallbackListener } from "@remotion/player";
import { durationFrames } from "../../../../packages/contracts";
import { Input } from "../ui/Input";
import { useEditor } from "./EditorContext";

function timecode(frame: number) {
  const seconds = Math.floor(frame / 30);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(
      2,
      "0",
    )}:${(seconds % 60).toString().padStart(2, "0")}:${(frame % 30).toString().padStart(2, "0")}`;
}

export function TimelineScrubber() {
  const { player, draft } = useEditor();
  const frames = durationFrames(draft);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const current = player.current;
    if (!current) return;
    setFrame(current.getCurrentFrame());
    const update: CallbackListener<"frameupdate"> = (event) =>
      setFrame(event.detail.frame);
    current.addEventListener("frameupdate", update);
    return () => current.removeEventListener("frameupdate", update);
  }, [player, frames]);
  const at = Math.min(frame, frames - 1);
  return (
    <div
      className="timeline-scrubber"
      style={
        {
          "--playhead": `${(at / Math.max(1, frames - 1)) * 100}%`,
        } as CSSProperties
      }
    >
      <div className="timeline-ruler" aria-hidden="true">
        {[0, 0.25, 0.5, 0.75, 1].map((position) => (
          <span key={position}>
            {timecode(Math.round(position * (frames - 1))).slice(0, 5)}
          </span>
        ))}
      </div>
      <Input
        className="timeline-seek"
        type="range"
        aria-label="Seek film"
        aria-valuetext={timecode(at)}
        min={0}
        max={frames - 1}
        value={at}
        onChange={(event) => player.current?.seekTo(Number(event.target.value))}
      />
      <span className="timeline-playhead" aria-hidden="true" />
    </div>
  );
}
