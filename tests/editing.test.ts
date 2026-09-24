import { it, expect } from "vitest";
import { shotSchema } from "../packages/contracts";
import { patchShot, splitShot } from "../packages/director/editing";
const scene = () =>
  shotSchema.parse({
    id: "scene",
    title: "Save",
    assetId: "source",
    mode: "exact-ui",
    template: "showcase",
    duration: 6,
    trimStart: 2,
    playbackRate: 1,
    caption: "Save the result",
    prompt: "",
    motion: "still",
    emphasis: [
      { at: 2, x: 0.5, y: 0.5, duration: 0.7, label: "Save" },
      { at: 5, x: 0.7, y: 0.4, duration: 0.7, label: "Saved" },
    ],
    focalEnd: { x: 0.2, y: 0.2, width: 0.5, height: 0.5 },
  });
it("keeps click highlights attached to source times after trim and speed edits", () => {
  const s = patchShot(scene(), { trimStart: 3, playbackRate: 2, duration: 2 });
  expect(s.emphasis).toHaveLength(1);
  expect(s.emphasis[0].at).toBe(0.5);
  expect(s.emphasis[0].duration).toBe(0.35);
  expect(patchShot(s, { assetId: "different" }).emphasis).toEqual([]);
});
it("splits footage with continuous source timing, focal endpoints and no second fade", () => {
  const [a, b] = splitShot(scene(), 3, "second");
  expect(a.duration + b.duration).toBe(6);
  expect(b.trimStart).toBe(5);
  expect(a.focalEnd).toEqual(b.focalRect);
  expect(b.transition).toBe("cut");
  expect(b.emphasis[0].at).toBe(2);
  expect(a.emphasis).toHaveLength(1);
});
