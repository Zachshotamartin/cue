import { afterAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import sharp from "sharp";
import {
  createProject,
  enqueue,
  getJob,
  updateJob,
  db,
  assets,
  takes,
} from "../packages/storage/db";
import { dataDir } from "../packages/storage/config";
import { importMedia } from "../packages/storage/media";
const provider = vi.hoisted(() => ({
  submitVideo: vi.fn(),
  pollVideo: vi.fn(),
  cancelVideo: vi.fn(),
  downloadOutput: vi.fn(),
  planStoryboard: vi.fn(),
  synthesize: vi.fn(),
}));
vi.mock("../packages/providers", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  ...provider,
}));
vi.mock("../apps/worker/render", () => ({ renderFilm: vi.fn() }));
import { runJob } from "../apps/worker/runner";
import { ProviderError } from "../packages/providers";
afterAll(async () => {
  await db.close();
  await fs.rm(dataDir, { recursive: true, force: true });
});
async function job() {
  const p = await createProject("Job recovery");
  const a = await importMedia(
    p.id,
    await sharp({
      create: { width: 40, height: 40, channels: 3, background: "#df603c" },
    })
      .png()
      .toBuffer(),
    "source.png",
  );
  return await enqueue(
    p.id,
    "generate",
    {
      sourceAssetId: a.id,
      sourceHash: a.hash,
      shotId: "scene",
      shotTitle: "Scene",
      model: "gen4_turbo",
      seconds: 5,
      prompt: "Gentle movement",
      format: "landscape",
    },
    crypto.randomUUID(),
    25,
  );
}
describe("durable provider jobs", () => {
  it("resumes a saved provider ID without submitting again", async () => {
    vi.clearAllMocks();
    const j = await job();
    const resumed = await updateJob(j, {
      state: "running",
      providerTaskId: "saved-task",
      reservedCents: 0,
      chargedCents: 25,
    });
    provider.pollVideo.mockResolvedValueOnce({
      status: "RUNNING",
      progress: 0.3,
    });
    await runJob(resumed);
    expect(provider.submitVideo).not.toHaveBeenCalled();
    expect(provider.pollVideo).toHaveBeenCalledWith("local", "saved-task");
    expect((await getJob(j.id)).state).toBe("running");
  });
  it("does not retry an ambiguous submission or release its reservation", async () => {
    vi.clearAllMocks();
    const j = await job();
    provider.submitVideo.mockRejectedValueOnce(new Error("Connection lost"));
    await runJob(j);
    const saved = await getJob(j.id);
    expect(saved.state).toBe("unknown");
    expect(saved.reservedCents).toBe(25);
    expect(provider.submitVideo).toHaveBeenCalledTimes(1);
  });
  it("releases a rejected request, without exposing raw provider data", async () => {
    vi.clearAllMocks();
    const j = await job();
    provider.submitVideo.mockRejectedValueOnce(
      new ProviderError("Provider request failed (401).", true),
    );
    await runJob(j);
    expect((await getJob(j.id)).state).toBe("failed");
    expect((await getJob(j.id)).reservedCents).toBe(0);
  });
  it("cancels a saved provider task, keeps its potential charge, and never resubmits", async () => {
    vi.clearAllMocks();
    const j = await job();
    const cancelled = await updateJob(j, {
      state: "running",
      providerTaskId: "cancel-me",
      cancelRequested: true,
      reservedCents: 0,
      chargedCents: 25,
    });
    provider.cancelVideo.mockResolvedValueOnce(undefined);
    await runJob(cancelled);
    expect(provider.cancelVideo).toHaveBeenCalledWith("local", "cancel-me");
    expect(provider.submitVideo).not.toHaveBeenCalled();
    expect((await getJob(j.id)).state).toBe("cancelled");
    expect((await getJob(j.id)).chargedCents).toBe(25);
  });
  it("finishes a saved planner result without paying for another plan", async () => {
    vi.clearAllMocks();
    const p = await createProject("Saved plan"),
      j = await enqueue(
        p.id,
        "plan",
        { draft: p.draft },
        crypto.randomUUID(),
        25,
      );
    await runJob(
      await updateJob(j, {
        state: "running",
        payload: { ...j.payload, result: p.draft },
        chargedCents: 25,
        reservedCents: 0,
      }),
    );
    expect(provider.planStoryboard).not.toHaveBeenCalled();
    expect((await getJob(j.id)).state).toBe("completed");
  });
  it("retries output retrieval against the same task ID", async () => {
    vi.clearAllMocks();
    const j = await job();
    const resumed = await updateJob(j, {
      state: "retrieving",
      providerTaskId: "same-task",
      reservedCents: 0,
      chargedCents: 25,
    });
    provider.pollVideo.mockResolvedValueOnce({
      status: "SUCCEEDED",
      output: ["https://runwayml.com/result.mp4"],
    });
    provider.downloadOutput.mockRejectedValueOnce(
      new Error("Expired connection"),
    );
    await runJob(resumed);
    const saved = await getJob(j.id);
    expect(saved.providerTaskId).toBe("same-task");
    expect(saved.payload.retries).toBe(1);
    expect(saved.state).toBe("running");
    expect(provider.submitVideo).not.toHaveBeenCalled();
  });
  it.each(["openai", "anthropic"])(
    "routes a queued %s plan without changing the live timeline",
    async (planner) => {
      vi.clearAllMocks();
      const p = await createProject("Selected planner");
      const a = await importMedia(
        p.id,
        await sharp({
          create: { width: 20, height: 20, channels: 3, background: "red" },
        })
          .png()
          .toBuffer(),
        "source.png",
      );
      const j = await enqueue(
        p.id,
        "plan",
        { draft: p.draft, provider: planner, model: "pinned-model" },
        crypto.randomUUID(),
        25,
      );
      provider.planStoryboard.mockResolvedValueOnce({
        description: "A proposal",
        shots: Array.from({ length: 4 }, () => ({
          title: "Scene",
          assetId: a.id,
          evidenceIds: [a.id],
          purpose: "Show product",
          template: "showcase",
          mode: "exact-ui",
          duration: 5,
          caption: "A real screen",
          narration: "",
          prompt: "",
          motion: "push",
        })),
      });
      await runJob(j);
      const saved = await getJob(j.id);
      expect(provider.planStoryboard).toHaveBeenCalledWith(
        "local",
        expect.any(String),
        [a],
        planner,
        "pinned-model",
      );
      expect(saved.state).toBe("completed");
      expect(saved.payload.provider).toBe(planner);
      expect(saved.payload.result.shots).toHaveLength(4);
      expect(saved.chargedCents).toBe(25);
      expect(saved.reservedCents).toBe(0);
      expect(
        (await db.prepare("SELECT revision FROM projects WHERE id=?").get(p.id))
          .revision,
      ).toBe(1);
    },
  );
  it("accounts for a confirmed planner refusal and does not retry it", async () => {
    vi.clearAllMocks();
    const p = await createProject("Refused plan");
    const j = await enqueue(
      p.id,
      "plan",
      { draft: p.draft, provider: "anthropic" },
      crypto.randomUUID(),
      25,
    );
    provider.planStoryboard.mockRejectedValueOnce(
      new ProviderError(
        "Claude could not complete the storyboard. Your film is unchanged.",
        true,
        true,
      ),
    );
    await runJob(j);
    const saved = await getJob(j.id);
    expect(saved.state).toBe("failed");
    expect(saved.chargedCents).toBe(25);
    expect(saved.reservedCents).toBe(0);
    expect(provider.planStoryboard).toHaveBeenCalledTimes(1);
    expect(saved.payload.result).toBeUndefined();
  });
});
