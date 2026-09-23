"use client";
import { useEditor } from "./EditorContext";
import { TimelineShot } from "./TimelineShot";
import { TimelineScrubber } from "./TimelineScrubber";

export function Timeline() {
  const { draft } = useEditor();
  const total = draft.shots.reduce((sum, scene) => sum + scene.duration, 0);
  const shortest = Math.min(...draft.shots.map((scene) => scene.duration));
  return (
    <div className="timeline-scroll">
      <div
        className="timeline-track"
        style={{ minWidth: draft.shots.length ? (total / shortest) * 72 : 0 }}
      >
        {draft.shots.length > 0 && <TimelineScrubber />}
        <div
          className="timeline"
          aria-label="Film timeline"
          style={{
            gridTemplateColumns: draft.shots.length
              ? draft.shots.map((scene) => `${scene.duration}fr`).join(" ")
              : "1fr",
          }}
        >
          {draft.shots.map((s, i) => (
            <TimelineShot key={s.id || i} s={s} i={i} />
          ))}
          {!draft.shots.length && (
            <span className="timeline-empty">
              Your scenes will appear here.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
