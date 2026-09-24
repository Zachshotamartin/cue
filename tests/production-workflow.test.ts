import { describe, it, expect } from "vitest";
import { defaultDraft, shotSchema, draftSchema } from "../packages/contracts";
import { sampleTimes } from "../packages/contracts/evidence";
import { mergeStory } from "../packages/director/revisions";
import { speechSrt, musicGain } from "../packages/compositor/captions";
import { alignmentCues } from "../packages/providers/audio";
import { assertDataEnvironment } from "../packages/storage/environment";
import { rankCaptures } from "../packages/director/evidence";
import type { Asset } from "../packages/contracts";
const shot = (id: string, extra = {}) =>
  shotSchema.parse({
    id,
    title: id,
    assetId: null,
    template: "showcase",
    mode: "exact-ui",
    duration: 5,
    caption: "",
    prompt: "",
    motion: "still",
    ...extra,
  });
describe("evidence-driven films", () => {
  it("prioritizes the requested feature and preserves distinct recordings on the same route", () => {
    const draft = defaultDraft("Film", "");
    draft.features = ["Extract voice"];
    const asset = (id: string, text: string): Asset => ({
      id,
      projectId: "test",
      kind: "video",
      name: id,
      mime: "video/mp4",
      bytes: 1,
      hash: id,
      path: id,
      createdAt: "",
      duration: 20,
      metadata: {
        text,
        url: "https://example.test/app",
        state: "Recorded workflow",
      },
    });
    const first = asset("landing", "Welcome"),
      second = asset("voice", "Extract voice and hear a clean result"),
      third = asset("followup", "Export extracted voice"),
      privateAsset = asset("hidden", "Extract voice");
    privateAsset.metadata.privacyPending = true;
    const ranked = rankCaptures(draft, [first, privateAsset, second, third], 3);
    expect(ranked.map((a) => a.id)).toEqual(["voice", "followup", "landing"]);
  });
  it("samples around actions after idle lead-in within a bounded frame budget", () => {
    const times = sampleTimes(30, [
      { at: 22, type: "click", label: "Create project" },
      { at: 26, type: "result", label: "Project saved" },
    ]);
    expect(times.length).toBeLessThanOrEqual(12);
    expect(times).toContain(21.5);
    expect(times).toContain(24);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times.every((t) => t >= 0 && t < 30)).toBe(true);
  });
  it("retains locked scene order, purchased media and newer non-story changes", () => {
    const current = defaultDraft("September launch", "https://example.com");
    current.productName = "My product";
    current.shots = [
      shot("a"),
      shot("locked", {
        locked: true,
        selectedTakeId: "paid",
        narrationAssetId: "voice",
      }),
      shot("c"),
    ];
    const proposal = {
      ...current,
      productName: "Old name",
      shots: [shot("new1"), shot("new2")],
    };
    const merged = mergeStory(current, proposal);
    expect(merged.shots.map((s) => s.id)).toEqual(["new1", "locked", "new2"]);
    expect(merged.shots[1].selectedTakeId).toBe("paid");
    expect(merged.productName).toBe("My product");
    expect(current.shots[0].id).toBe("a");
  });
  it("upgrades pre-version projects without losing existing edits", () => {
    const raw: any = defaultDraft("Legacy", "");
    delete raw.version;
    delete raw.productName;
    delete raw.soundCues;
    raw.shots = [shot("old")];
    delete raw.shots[0].playbackRate;
    const upgraded = draftSchema.parse(raw);
    expect(upgraded.version).toBe(2);
    expect(upgraded.soundCues).toEqual([]);
    expect(upgraded.shots[0].playbackRate).toBe(1);
  });
  it("exports aligned speech rather than pretending marketing copy is transcription", () => {
    const d = defaultDraft("Film", "");
    d.shots = [
      shot("silent", { caption: "Not spoken" }),
      shot("voice", {
        speechCues: [{ start: 0.5, end: 1.5, text: "Hello there" }],
      }),
    ];
    expect(speechSrt(d)).toBe(
      "1\n00:00:05,500 --> 00:00:06,500\nHello there\n",
    );
    expect(() =>
      shot("bad", { speechCues: [{ start: 2, end: 1, text: "invalid" }] }),
    ).toThrow();
  });
  it("groups timestamp alignment and ducks only around actual speech with smooth release", () => {
    expect(
      alignmentCues({
        characters: ["H", "i"],
        character_start_times_seconds: [0.2, 0.3],
        character_end_times_seconds: [0.3, 0.6],
      }),
    ).toEqual([{ start: 0.2, end: 0.6, text: "Hi" }]);
    const windows = [{ start: 2, end: 4, enabled: true }];
    expect(musicGain(3, 10, windows)).toBeCloseTo(0.28);
    expect(musicGain(5, 10, windows)).toBe(1);
    expect(musicGain(4.15, 10, windows)).toBeGreaterThan(0.28);
    expect(musicGain(0, 10, windows)).toBe(0);
    expect(musicGain(10, 10, windows)).toBe(0);
  });
  it("rejects local production credentials and unisolated hosted previews", () => {
    expect(() =>
      assertDataEnvironment({
        DATABASE_URL: "postgres://prod.invalid/cue",
        CUE_DATA_ENVIRONMENT: "production",
      }),
    ).toThrow();
    expect(() =>
      assertDataEnvironment({
        VERCEL: "1",
        VERCEL_ENV: "preview",
        DATABASE_URL: "postgres://prod.invalid/cue",
      }),
    ).toThrow();
    expect(() =>
      assertDataEnvironment({
        DATABASE_URL: "postgres://127.0.0.1/cue_development",
        CUE_STORAGE: "local",
      }),
    ).not.toThrow();
  });
});

it("does not trade approved media or unrelated edits for a one-scene rewrite", async () => {
  const { replaceScene } = await import("../packages/director/revisions");
  const base = defaultDraft("Film", "");
  base.shots = [shot("first", { selectedTakeId: "paid" }), shot("replace")];
  const current = structuredClone(base);
  current.productName = "New product name";
  const proposed = { ...base, shots: [shot("alternative")] };
  const next = replaceScene(current, base, proposed, "replace", "alternative");
  expect(next.shots[0].selectedTakeId).toBe("paid");
  expect(next.productName).toBe("New product name");
  current.shots[1].caption = "Changed while planning";
  expect(() =>
    replaceScene(current, base, proposed, "replace", "alternative"),
  ).toThrow("changed after planning");
});
it("supports a rolling credential rotation without allowing cross-account decryption", async () => {
  const { encryptCredential, decryptCredential } =
    await import("../packages/storage/credentials");
  const original = process.env.CUE_MASTER_KEY;
  const encrypted = encryptCredential(
    "rotation-owner",
    "openai",
    "fixture-secret",
  );
  process.env.CUE_MASTER_KEY_PREVIOUS = original;
  process.env.CUE_MASTER_KEY = "ab".repeat(32);
  try {
    expect(decryptCredential("rotation-owner", "openai", encrypted)).toBe(
      "fixture-secret",
    );
    expect(() =>
      decryptCredential("other-owner", "openai", encrypted),
    ).toThrow();
    const fresh = encryptCredential("rotation-owner", "openai", "new-secret");
    delete process.env.CUE_MASTER_KEY_PREVIOUS;
    expect(decryptCredential("rotation-owner", "openai", fresh)).toBe(
      "new-secret",
    );
  } finally {
    process.env.CUE_MASTER_KEY = original;
    delete process.env.CUE_MASTER_KEY_PREVIOUS;
  }
});
