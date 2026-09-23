import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const storage = vi.hoisted(() => ({ getJob: vi.fn(), updateJob: vi.fn() }));
vi.mock("../packages/storage/db", () => storage);
import { createRenderMonitor } from "../apps/worker/render-monitor";

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  storage.getJob.mockResolvedValue({ id: "render", progress: 0 });
  storage.updateJob.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe("render progress and cancellation", () => {
  it("coalesces hundreds of frame callbacks into one latest-progress update", async () => {
    const monitor = createRenderMonitor({ id: "render", progress: 0 }, vi.fn());
    for (let i = 0; i <= 700; i++) monitor.onProgress({ progress: i / 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(storage.getJob).toHaveBeenCalledOnce();
    expect(storage.updateJob).toHaveBeenCalledExactlyOnceWith(
      { id: "render", progress: 0 },
      expect.objectContaining({ progress: 63 }),
    );
    await monitor.stop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(storage.getJob).toHaveBeenCalledOnce();
  });

  it("never overlaps requests while the database is slow and drains before stopping", async () => {
    let release!: (value: unknown) => void;
    storage.getJob.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const monitor = createRenderMonitor({ id: "render", progress: 0 }, vi.fn());
    monitor.onProgress({ progress: 0.2 });
    await vi.advanceTimersByTimeAsync(5000);
    monitor.onProgress({ progress: 0.8 });
    expect(storage.getJob).toHaveBeenCalledOnce();
    let stopped = false;
    const stopping = monitor.stop().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);
    release({ id: "render", progress: 0 });
    await stopping;
    expect(storage.updateJob.mock.calls[0]?.[1].progress).toBe(72);
  });

  it("cancels on a database failure and propagates it through the awaited render job", async () => {
    storage.updateJob.mockRejectedValue(new Error("database unavailable"));
    const cancel = vi.fn();
    const monitor = createRenderMonitor({ id: "render", progress: 0 }, cancel);
    monitor.onProgress({ progress: 0.5 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(cancel).toHaveBeenCalledOnce();
    await expect(monitor.stop()).rejects.toThrow("database unavailable");
  });

  it("checks cancellation even when rendering progress has stalled", async () => {
    storage.getJob.mockResolvedValue({
      id: "render",
      progress: 0,
      cancelRequested: true,
    });
    const cancel = vi.fn();
    const monitor = createRenderMonitor({ id: "render", progress: 0 }, cancel);
    await vi.advanceTimersByTimeAsync(1000);
    expect(cancel).toHaveBeenCalledOnce();
    expect(storage.updateJob).not.toHaveBeenCalled();
    await monitor.stop();
  });
});
