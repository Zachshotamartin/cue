import { afterEach, expect, it, vi } from "vitest";
import { generateSound, timedSpeech } from "../packages/providers/audio";
import { verifyConnection } from "../packages/providers/connections";
vi.mock("../packages/storage/credentials", () => ({
  credential: async () => "fixture-key",
}));
afterEach(() => vi.unstubAllGlobals());
it("uses non-billable account metadata for connection checks and never echoes provider errors", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response("secret debug payload", { status: 401 }));
  vi.stubGlobal("fetch", fetch);
  const result = await verifyConnection("fixture", "openai");
  expect(result.status).toBe("rejected");
  expect(JSON.stringify(result)).not.toContain("secret");
  expect(fetch.mock.calls[0][1].method).toBeUndefined();
});
it("validates voice IDs before sending and keeps genuine alignment with returned audio", async () => {
  const fetch = vi.fn().mockResolvedValue(
    Response.json({
      audio_base64: Buffer.from("fixture-audio").toString("base64"),
      alignment: {
        characters: ["H", "i"],
        character_start_times_seconds: [0.1, 0.2],
        character_end_times_seconds: [0.2, 0.3],
      },
    }),
  );
  vi.stubGlobal("fetch", fetch);
  await expect(timedSpeech("fixture", "Hi", "bad/path")).rejects.toThrow(
    "valid voice",
  );
  expect(fetch).not.toHaveBeenCalled();
  const dictionaries = [
    { pronunciation_dictionary_id: "brand-dictionary", version_id: "v2" },
  ];
  const result = await timedSpeech("fixture", "Hi", "voice1234", dictionaries);
  expect(result.cues).toEqual([{ start: 0.1, end: 0.3, text: "Hi" }]);
  expect(result.buffer.toString()).toBe("fixture-audio");
  expect(fetch.mock.calls[0][0]).toContain("with-timestamps");
  expect(
    JSON.parse(fetch.mock.calls[0][1].body).pronunciation_dictionary_locators,
  ).toEqual(dictionaries);
});
it("requests instrumental music and duration-bounded sound effects", async () => {
  const fetch = vi.fn().mockImplementation(async () => new Response("audio"));
  vi.stubGlobal("fetch", fetch);
  await generateSound("fixture", "music", "warm bed", 3);
  await generateSound("fixture", "sound", "click", 1);
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
    force_instrumental: true,
    music_length_ms: 3000,
  });
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({
    duration_seconds: 1,
    model_id: "eleven_text_to_sound_v2",
  });
});
