export type SidebarSide = "left" | "right";
export type SidebarPreference = { width: number; collapsed: boolean };
export const sidebarLimits = {
  left: { min: 176, max: 380, initial: 225 },
  right: { min: 280, max: 520, initial: 320 },
};
export const collapsedWidth = 42;
export const minimumStageWidth = 280;
export function sidebarWidth(
  side: SidebarSide,
  width: number,
  available = Infinity,
) {
  const { min, max } = sidebarLimits[side];
  return Math.round(
    Math.min(
      max,
      Math.max(
        min,
        Math.min(
          Number.isFinite(width) ? width : sidebarLimits[side].initial,
          available,
        ),
      ),
    ),
  );
}
export function readSidebarPreference(
  side: SidebarSide,
  raw: string | null,
): SidebarPreference {
  try {
    const parsed = JSON.parse(raw || "null");
    if (
      parsed &&
      typeof parsed.width === "number" &&
      typeof parsed.collapsed === "boolean"
    )
      return {
        width: sidebarWidth(side, parsed.width),
        collapsed: parsed.collapsed,
      };
  } catch {}
  return { width: sidebarLimits[side].initial, collapsed: false };
}

/** Shrink both panels proportionally, then consume any remaining room from either panel. */
export function fitSidebars(
  panels: Record<SidebarSide, SidebarPreference>,
  available: number,
) {
  const left = panels.left.collapsed
    ? collapsedWidth
    : sidebarWidth("left", panels.left.width);
  const right = panels.right.collapsed
    ? collapsedWidth
    : sidebarWidth("right", panels.right.width);
  const leftRoom = panels.left.collapsed ? 0 : left - sidebarLimits.left.min;
  const rightRoom = panels.right.collapsed
    ? 0
    : right - sidebarLimits.right.min;
  const excess = Math.min(
    leftRoom + rightRoom,
    Math.max(0, left + right + minimumStageWidth - available),
  );
  const leftCut = Math.min(leftRoom, Math.ceil(excess / 2)),
    rightCut = Math.min(rightRoom, excess - leftCut);
  const remaining = excess - leftCut - rightCut;
  const extraLeft = Math.min(leftRoom - leftCut, remaining);
  return {
    left: left - leftCut - extraLeft,
    right: right - rightCut - (remaining - extraLeft),
  };
}
