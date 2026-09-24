"use client";
import { useRef, useState, type ReactNode } from "react";
import type { Shot } from "../../../../packages/contracts";
type Point = { x: number; y: number };
export function RegionSelector({
  ratio,
  children,
  onRegion,
  onPoint,
  minSize = 0.01,
}: {
  ratio: string;
  children: ReactNode;
  onRegion?: (rect: Shot["focalRect"]) => void;
  onPoint?: (point: Point) => void;
  minSize?: number;
}) {
  const start = useRef<Point | null>(null),
    [preview, setPreview] = useState<Shot["focalRect"] | null>(null);
  const point = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  };
  const rectangle = (a: Point, b: Point) => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  });
  return (
    <div
      className="crop-surface"
      style={{ aspectRatio: ratio }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        start.current = point(e);
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (start.current && onRegion)
          setPreview(rectangle(start.current, point(e)));
      }}
      onPointerUp={(e) => {
        const a = start.current;
        start.current = null;
        setPreview(null);
        if (!a) return;
        const b = point(e),
          rect = rectangle(a, b);
        if (onRegion && rect.width >= minSize && rect.height >= minSize)
          onRegion(rect);
        onPoint?.(b);
      }}
      onPointerCancel={() => {
        start.current = null;
        setPreview(null);
      }}
    >
      {children}
      {preview && (
        <div
          className="crop-outline"
          style={{
            left: `${preview.x * 100}%`,
            top: `${preview.y * 100}%`,
            width: `${preview.width * 100}%`,
            height: `${preview.height * 100}%`,
          }}
        />
      )}
    </div>
  );
}
