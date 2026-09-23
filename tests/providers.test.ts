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
  planStoryboard,
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
              parts: [
                {
                  text: JSON.stringify({
                    description: "Product",
                    shots: Array.from({ length: 4 }, () => ({ duration: 5 })),
                  }),
                },
              ],
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
  it.each(["openai", "anthropic"] as const)(
    "sends private image evidence only to the selected %s planner with strict output",
    async (provider) => {
      const p = await createProject("Planner evidence");
      const a = await importMedia(
        p.id,
        await sharp({
          create: { width: 40, height: 30, channels: 3, background: "blue" },
        })
          .png()
          .toBuffer(),
        "evidence.png",
      );
      await putCredential("planner-owner", provider, `test-${provider}-key`);
      const plan = {
        description: "A captured product",
        shots: Array.from({ length: 4 }, () => ({
          assetId: a.id,
          duration: 5,
        })),
      };
      const response =
        provider === "openai"
          ? {
              status: "completed",
              output: [
                {
                  type: "message",
                  role: "assistant",
                  content: [
                    { type: "output_text", text: JSON.stringify(plan) },
                  ],
                },
              ],
            }
          : {
              stop_reason: "end_turn",
              content: [{ type: "text", text: JSON.stringify(plan) }],
            };
      const fetcher = vi.fn().mockResolvedValue(Response.json(response));
      vi.stubGlobal("fetch", fetcher);
      expect(
        await planStoryboard(
          "planner-owner",
          "Use only these screens",
          [a],
          provider,
          "saved-model-snapshot",
        ),
      ).toEqual(plan);
      expect(fetcher).toHaveBeenCalledTimes(1);
      const [url, options] = fetcher.mock.calls[0],
        body = JSON.parse(options.body);
      expect(body.model).toBe("saved-model-snapshot");
      expect(options.body).toContain(a.id);
      expect(options.body).not.toContain(a.path);
      if (provider === "openai") {
        expect(url).toBe("https://api.openai.com/v1/responses");
        expect(options.headers.Authorization).toBe("Bearer test-openai-key");
        expect(body.store).toBe(false);
        expect(body.input[0].content[2].image_url).toMatch(
          /^data:image\/jpeg;base64,/,
        );
        expect(body.text.format.strict).toBe(true);
        expect(body.text.format.schema.additionalProperties).toBe(false);
        expect(
          body.text.format.schema.properties.shots.items.additionalProperties,
        ).toBe(false);
      } else {
        expect(url).toBe("https://api.anthropic.com/v1/messages");
        expect(options.headers["x-api-key"]).toBe("test-anthropic-key");
        expect(options.headers["anthropic-version"]).toBe("2023-06-01");
        expect(body.messages[0].content[1].source).toMatchObject({
          type: "base64",
          media_type: "image/jpeg",
        });
        const schema = body.output_config.format.schema;
        expect(schema.additionalProperties).toBe(false);
        expect(schema.properties.shots).not.toHaveProperty("maxItems");
        expect(
          schema.properties.shots.items.properties.duration,
        ).not.toHaveProperty("minimum");
      }
      fetcher.mockClear();
      await expect(
        planStoryboard("another-account", "private", [a], provider),
      ).rejects.toThrow("Configure");
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it.each([
    [
      "openai",
      {
        status: "completed",
        output: [
          {
            type: "message",
            role: "assistant",
            content: [{ type: "refusal", refusal: "private refusal" }],
          },
        ],
      },
    ],
    ["openai", { status: "incomplete", output: [] }],
    ["anthropic", { stop_reason: "max_tokens", content: [] }],
    ["anthropic", { stop_reason: "refusal", content: [] }],
    [
      "anthropic",
      {
        stop_reason: "end_turn",
        content: [
          {
            type: "text",
            text: '{"description":"private text","shots":[{"duration":1000}]}',
          },
        ],
      },
    ],
  ] as const)(
    "rejects incomplete or refused %s responses without retry or evidence disclosure",
    async (provider, body) => {
      const fetcher = vi.fn().mockResolvedValue(Response.json(body));
      vi.stubGlobal("fetch", fetcher);
      await expect(
        planStoryboard("planner-owner", "Plan", [], provider),
      ).rejects.toMatchObject({ definitive: true, billable: true });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
});
