import { describe, it, expect } from "vitest";
import {
  fitSidebars,
  sidebarWidth,
  readSidebarPreference,
  minimumStageWidth,
} from "../apps/editor/components/ui/sidebar-layout";
describe("workspace layout", () => {
  it("clamps dragging and damaged saved preferences", () => {
    expect(sidebarWidth("left", -500)).toBe(176);
    expect(sidebarWidth("right", Infinity)).toBe(320);
    expect(sidebarWidth("right", 900)).toBe(520);
    expect(readSidebarPreference("left", "broken")).toEqual({
      width: 225,
      collapsed: false,
    });
    expect(
      readSidebarPreference("right", '{"width":10000,"collapsed":true}'),
    ).toEqual({ width: 520, collapsed: true });
  });
  it("preserves a usable preview for every desktop width and panel combination", () => {
    for (const width of [901, 950, 1024, 1280, 1920])
      for (const left of [176, 225, 380])
        for (const right of [280, 320, 520])
          for (const lc of [true, false])
            for (const rc of [true, false]) {
              const fit = fitSidebars(
                {
                  left: { width: left, collapsed: lc },
                  right: { width: right, collapsed: rc },
                },
                width,
              );
              expect(
                fit.left + fit.right + minimumStageWidth,
              ).toBeLessThanOrEqual(width);
              expect(fit.left).toBeGreaterThanOrEqual(lc ? 42 : 176);
              expect(fit.right).toBeGreaterThanOrEqual(rc ? 42 : 280);
            }
  });
  it("restores preferred sizes when space returns", () => {
    const panels = {
      left: { width: 380, collapsed: false },
      right: { width: 520, collapsed: false },
    };
    expect(fitSidebars(panels, 901)).not.toEqual({ left: 380, right: 520 });
    expect(fitSidebars(panels, 1600)).toEqual({ left: 380, right: 520 });
  });
});
