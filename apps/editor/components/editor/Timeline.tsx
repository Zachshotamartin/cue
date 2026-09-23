"use client";
import { useEditor } from "./EditorContext";
import { TimelineShot } from "./TimelineShot";

export function Timeline() {
  const { draft } = useEditor();
  return (
    <>
      <div className="timeline" aria-label="Film timeline">
        {draft.shots.map((s, i) => (
          <TimelineShot key={s.id || i} s={s} i={i} />
        ))}
        {!draft.shots.length && (
          <span className="timeline-empty">Your scenes will appear here.</span>
        )}
      </div>
    </>
  );
}
