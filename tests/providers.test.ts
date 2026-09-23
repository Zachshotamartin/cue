import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import sharp from "sharp";
import { createProject, db } from "../packages/storage/db";
import { importMedia } from "../packages/storage/media";
import { putCredential } from "../packages/storage/credentials";
import { dataDir } from "../packages/storage/config";
import {
  submitVideo,
  pollVideo,
  cancelVideo,
  downloadOutput,
  planWithGemini,
  synthesize,
  videoPrice,
} from "../packages/providers";
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  await db.close();
  await fs.rm(dataDir, { recursive: true, force: true });
});
describe("provider wire contracts (stubbed HTTP, no paid requests)", () => {
  it("sends the bounded reference, supported ratio, and reviewed generation options", async () => {
    const p = await createProject("Contract"),
      a = await importMedia(
        p.id,
        await sharp({
          create: {
            width: 100,
            height: 60,
            channels: 3,
            background: "#f3f3ee",
          },
        })
          .png()
          .toBuffer(),
        "source.png",
      );
    await putCredential("local", "runway", "test-runway-only");
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ id: "task-123" }));
    vi.stubGlobal("fetch", fetcher);
    expect(
      await submitVideo(
        "local",
        a,
        "Gentle movement",
        "gen4_turbo",
        5,
        "portrait",
      ),
    ).toBe("task-123");
    const [url, options] = fetcher.mock.calls[0],
      body = JSON.parse(options.body);
    expect(url).toBe("https://api.dev.runwayml.com/v1/image_to_video");
    expect(body.ratio).toBe("720:1280");
    expect(body.duration).toBe(5);
    expect(body.promptImage).toMatch(/^data:image\/jpeg;base64,/);
    expect(options.headers["X-Runway-Version"]).toBe("2024-11-06");
    expect(() => videoPrice("unsupported", 5)).toThrow();
    expect(() => videoPrice("gen4_turbo", 7)).toThrow();
  });
  it("encodes task identifiers, and uses DELETE for cancellation", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(Response.json({ status: "RUNNING" })),
      );
    vi.stubGlobal("fetch", fetcher);
    await pollVideo("local", "task/123");
    await cancelVideo("local", "task/123");
    expect(fetcher.mock.calls[0][0]).toContain("task%2F123");
    expect(fetcher.mock.calls[1][1].method).toBe("DELETE");
  });
  it("rejects untrusted output hosts and never follows redirect chains", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal("fetch", fetcher);
    await expect(downloadOutput("http://127.0.0.1/private")).rejects.toThrow(
      "unexpected output host",
    );
    expect(fetcher).not.toHaveBeenCalled();
    await downloadOutput("https://example.cloudfront.net/output.mp4");
    expect(fetcher.mock.calls[0][1].redirect).toBe("error");
  });
  it("sends a structured planning contract and does not log provider bodies", async () => {
    await putCredential("local", "gemini", "test-gemini-only");
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        candidates: [
          {
            content: {
              parts: [{ text: '{"description":"Product","shots":[]}' }],
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(
      (await planWithGemini("local", "Direct this film", [])).description,
    ).toBe("Product");
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(
      body.generationConfig.responseJsonSchema.properties.shots,
    ).toBeTruthy();
    fetcher.mockResolvedValueOnce(
      new Response("sensitive-upstream-secret", { status: 401 }),
    );
    await expect(planWithGemini("local", "Plan", [])).rejects.toThrow(
      "Provider request failed (401)",
    );
  });
  it("uses the configured speech voice and refuses malformed IDs before a request", async () => {
    await putCredential("local", "elevenlabs", "test-eleven-only");
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal("fetch", fetcher);
    await expect(synthesize("local", "Hello", "../bad")).rejects.toThrow(
      "valid ElevenLabs",
    );
    expect(fetcher).not.toHaveBeenCalled();
    await synthesize("local", "Hello", "voice1234");
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.model_id).toBe("eleven_multilingual_v2");
    expect(body.text).toBe("Hello");
  });
});
