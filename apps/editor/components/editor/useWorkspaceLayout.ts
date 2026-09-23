"use client";
import { useEffect, useState } from "react";
import {
  fitSidebars,
  minimumStageWidth,
  readSidebarPreference,
  sidebarWidth,
  type SidebarSide,
} from "../ui/sidebar-layout";
export function useWorkspaceLayout() {
  const [panels, setPanels] = useState({
    left: readSidebarPreference("left", null),
    right: readSidebarPreference("right", null),
  });
  const [ready, setReady] = useState(false),
    [available, setAvailable] = useState(0);
  const [node, attach] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    try {
      setPanels({
        left: readSidebarPreference(
          "left",
          localStorage.getItem("cue:sidebar:left"),
        ),
        right: readSidebarPreference(
          "right",
          localStorage.getItem("cue:sidebar:right"),
        ),
      });
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      for (const side of ["left", "right"] as const)
        localStorage.setItem(
          `cue:sidebar:${side}`,
          JSON.stringify(panels[side]),
        );
    } catch {}
  }, [panels, ready]);
  // The ref attaches after the project loads; observe that node, not the loading screen.
  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(() => setAvailable(node.clientWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  const stacked = available <= 900;
  function maximum(side: SidebarSide) {
    const other = side === "left" ? "right" : "left";
    return (
      available - fitSidebars(panels, available)[other] - minimumStageWidth
    );
  }
  function resize(side: SidebarSide, width: number) {
    setPanels((p) => ({
      ...p,
      [side]: { ...p[side], width: sidebarWidth(side, width, maximum(side)) },
    }));
  }
  function collapse(side: SidebarSide, collapsed: boolean) {
    setPanels((p) => ({ ...p, [side]: { ...p[side], collapsed } }));
  }
  function displayedWidth(side: SidebarSide) {
    return fitSidebars(panels, available)[side];
  }
  return { panels, stacked, attach, resize, collapse, displayedWidth, maximum };
}
