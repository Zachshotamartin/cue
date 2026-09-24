import { it, expect } from "vitest";
import { RecordingClock } from "../apps/extension/recording-clock.js";
import { sampleTimes } from "../packages/contracts/evidence";
it("excludes paused wall time without double counting repeated pause/resume", () => {
  let now = 1000;
  const c = new RecordingClock(() => now);
  now = 3000;
  c.pause();
  now = 9000;
  c.pause();
  expect(c.elapsed()).toBe(2);
  c.resume();
  c.resume();
  now = 11000;
  expect(c.elapsed()).toBe(4);
});
it("does not let pointer events crowd action/result evidence out of analysis", () => {
  const times = sampleTimes(30, [
    ...Array.from({ length: 100 }, (_, i) => ({
      at: i / 10,
      type: "pointer" as const,
      label: "",
    })),
    { at: 22, type: "click", label: "Save" },
  ]);
  expect(times).toContain(21.5);
  expect(times).toContain(24);
});
