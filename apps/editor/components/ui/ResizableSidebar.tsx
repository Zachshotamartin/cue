"use client";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import {
  useId,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Button } from "./Button";
import { sidebarLimits, type SidebarSide } from "./sidebar-layout";
export function ResizableSidebar({
  side,
  label,
  width,
  collapsed,
  stacked,
  maxWidth,
  onResize,
  onCollapse,
  children,
}: {
  side: SidebarSide;
  label: string;
  width: number;
  collapsed: boolean;
  stacked: boolean;
  maxWidth: number;
  onResize: (width: number) => void;
  onCollapse: (collapsed: boolean) => void;
  children: ReactNode;
}) {
  const id = useId(),
    drag = useRef<{ x: number; width: number } | null>(null),
    [dragging, setDragging] = useState(false);
  const min = sidebarLimits[side].min,
    max = Math.max(min, Math.min(sidebarLimits[side].max, maxWidth));
  const pointsLeft = side === "left" ? !collapsed : collapsed;
  function stop(e: PointerEvent<HTMLDivElement>) {
    drag.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }
  return (
    <aside
      className={`resizable-sidebar sidebar-${side} ${collapsed ? "is-collapsed" : ""} ${dragging ? "is-resizing" : ""}`}
      style={stacked ? undefined : { width }}
      aria-label={label}
    >
      <Button
        className="sidebar-toggle"
        aria-label={`${collapsed ? "Expand" : "Collapse"} ${label.toLowerCase()}`}
        aria-expanded={!collapsed}
        aria-controls={id}
        title={`${collapsed ? "Expand" : "Collapse"} ${label.toLowerCase()}`}
        onClick={() => onCollapse(!collapsed)}
      >
        {pointsLeft ? <CaretLeft size={16} /> : <CaretRight size={16} />}
        <span>{label}</span>
      </Button>
      <div id={id} className="sidebar-content" hidden={collapsed}>
        {children}
      </div>
      {!collapsed && !stacked && (
        <div
          className="sidebar-resize-handle"
          role="separator"
          aria-label={`Resize ${label.toLowerCase()}`}
          aria-orientation="vertical"
          aria-controls={id}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={width}
          aria-valuetext={`${width} pixels`}
          tabIndex={0}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.currentTarget.focus();
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, width };
            setDragging(true);
          }}
          onPointerMove={(e) => {
            if (drag.current)
              onResize(
                drag.current.width +
                  (e.clientX - drag.current.x) * (side === "left" ? 1 : -1),
              );
          }}
          onPointerUp={stop}
          onPointerCancel={stop}
          onLostPointerCapture={() => {
            drag.current = null;
            setDragging(false);
          }}
          onDoubleClick={() => onResize(sidebarLimits[side].initial)}
          onKeyDown={(e) => {
            let next: number | undefined;
            const step = e.shiftKey ? 32 : 8;
            if (e.key === "ArrowLeft")
              next = width + (side === "left" ? -step : step);
            if (e.key === "ArrowRight")
              next = width + (side === "left" ? step : -step);
            if (e.key === "Home") next = min;
            if (e.key === "End") next = max;
            if (next !== undefined) {
              e.preventDefault();
              onResize(next);
            }
          }}
        />
      )}
    </aside>
  );
}
