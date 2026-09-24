"use client";
import { useRef, useState } from "react";
export function TimelineHandle({
  value,
  max,
  onChange,
  label,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const drag = useRef<{ x: number; value: number; scale: number } | null>(null),
    [pending, setPending] = useState<number | null>(null);
  const clamp = (v: number) =>
    Math.round(Math.max(1, Math.min(max, v)) * 30) / 30;
  return (
    <div
      className="timeline-handle"
      role="slider"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={max}
      aria-valuenow={pending ?? value}
      aria-valuetext={`${(pending ?? value).toFixed(1)} seconds`}
      tabIndex={0}
      title={`${label}: drag or use arrow keys`}
      onKeyDown={(e) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        onChange(
          e.key === "Home"
            ? 1
            : e.key === "End"
              ? max
              : clamp(
                  value +
                    (e.key === "ArrowRight" ? 1 : -1) *
                      (e.shiftKey ? 1 : 1 / 30),
                ),
        );
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const width =
          e.currentTarget.parentElement?.getBoundingClientRect().width || 72;
        drag.current = { x: e.clientX, value, scale: value / width };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (drag.current)
          setPending(
            clamp(
              drag.current.value +
                (e.clientX - drag.current.x) * drag.current.scale,
            ),
          );
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (d) onChange(clamp(d.value + (e.clientX - d.x) * d.scale));
        setPending(null);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setPending(null);
      }}
    >
      {pending !== null && (
        <span className="timeline-trim-value">{pending.toFixed(1)}s</span>
      )}
    </div>
  );
}
