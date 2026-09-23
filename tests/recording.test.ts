import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  beginRecording,
  appendRecordingChunk,
  finishRecording,
  recoverRecordings,
  getBlob,
  discardRecording,
} from "../apps/extension/shared.js";
describe("persisted recording chunks", () => {
  it("assembles chunks in time order, even when writes arrived out of order", async () => {
    const id = crypto.randomUUID();
    await beginRecording(id, { state: "Workflow" });
    await appendRecordingChunk(id, 1, new Blob(["second"]));
    await appendRecordingChunk(id, 0, new Blob(["first"]));
    expect(await finishRecording(id)).toBe(true);
    const saved: any = await getBlob(id);
    expect(await saved.blob.text()).toBe("firstsecond");
    expect(saved.metadata.state).toBe("Workflow");
  });
  it("recovers completed chunks after interruption with a visible warning", async () => {
    const id = crypto.randomUUID();
    await beginRecording(id, { state: "Recording" });
    await appendRecordingChunk(id, 0, new Blob(["partial"]));
    expect(await recoverRecordings()).toContain(id);
    const saved: any = await getBlob(id);
    expect(saved.metadata.warnings[0]).toContain("Recovered");
    expect(await recoverRecordings()).toEqual([]);
  });
  it("does not recover a discarded cross-origin segment", async () => {
    const id = crypto.randomUUID();
    await beginRecording(id, {});
    await appendRecordingChunk(id, 0, new Blob(["private"]));
    await discardRecording(id);
    expect(await recoverRecordings()).not.toContain(id);
    expect(await getBlob(id)).toBeUndefined();
  });
});
