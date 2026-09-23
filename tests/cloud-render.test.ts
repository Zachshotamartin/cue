import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  get: vi.fn(),
  getOrCreate: vi.fn(),
  getJob: vi.fn(),
  updateJob: vi.fn(),
}));
vi.mock("@vercel/sandbox", () => ({
  Sandbox: { get: mock.get, getOrCreate: mock.getOrCreate },
}));
vi.mock("../packages/storage/db", () => ({
  getJob: mock.getJob,
  updateJob: mock.updateJob,
}));
import { advanceRender, stopRender } from "../packages/cloud/render";
import type { Job } from "../packages/contracts";
const job = {
  id: "test-render",
  sandboxId: "test-sandbox",
  commandId: "test-command",
  state: "completed",
  createdAt: new Date().toISOString(),
  outputAssetId: "saved-film",
} as Job;
beforeEach(() => {
  vi.resetAllMocks();
  mock.getJob.mockResolvedValue(job);
  mock.updateJob.mockImplementation(async (_job, patch) => ({
    ...job,
    ...patch,
  }));
});
describe("render compute lifecycle", () => {
  it("does not resume a completed sandbox to stop it", async () => {
    const stop = vi.fn();
    mock.get.mockResolvedValue({ status: "stopped", stop });
    await stopRender(job.id);
    expect(mock.get).toHaveBeenCalledWith({
      name: job.sandboxId,
      resume: false,
    });
    expect(stop).not.toHaveBeenCalled();
  });
  it("stops a still-running completed renderer", async () => {
    const stop = vi.fn().mockResolvedValue(undefined);
    mock.get.mockResolvedValue({ status: "running", stop });
    await stopRender(job.id);
    expect(stop).toHaveBeenCalledOnce();
  });
  it("never reads a command from stopped compute, preserving a saved output", async () => {
    const getCommand = vi.fn(),
      stop = vi.fn().mockResolvedValue(undefined);
    mock.get.mockResolvedValue({ status: "stopped", getCommand, stop });
    mock.getJob.mockResolvedValue({ ...job, state: "retrieving" });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await advanceRender({ ...job, state: "retrieving" });
    expect(getCommand).not.toHaveBeenCalled();
    expect(mock.updateJob.mock.calls.at(-1)?.[1]).toMatchObject({
      state: "completed",
      progress: 100,
      error: null,
    });
    log.mockRestore();
  });
});
