import { RecordingClock } from "./recording-clock.js";
import {
  beginRecording,
  appendRecordingChunk,
  finishRecording,
  discardRecording,
} from "./shared.js";
let metadata,
  clock,
  maxSeconds = 60,
  hardTimeout,
  audioContext;
let recorder,
  stream,
  recordingId,
  timeout,
  discard = false,
  bytes = 0,
  index = 0,
  writes = Promise.resolve();
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (m.target !== "offscreen" || sender.id !== chrome.runtime.id) return;
  (async () => {
    if (m.type === "START") {
      if (recorder && recorder.state !== "inactive")
        throw new Error("Already recording.");
      discard = false;
      bytes = 0;
      index = 0;
      writes = Promise.resolve();
      recordingId = crypto.randomUUID();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: m.audio
          ? {
              mandatory: {
                chromeMediaSource: "tab",
                chromeMediaSourceId: m.streamId,
              },
            }
          : false,
        video: {
          mandatory: {
            chromeMediaSource: "tab",
            chromeMediaSourceId: m.streamId,
            maxFrameRate: 30,
          },
        },
      });
      metadata = { ...m.metadata, interactions: [] };
      if (m.audio && stream.getAudioTracks().length) {
        audioContext = new AudioContext();
        audioContext
          .createMediaStreamSource(stream)
          .connect(audioContext.destination);
      }
      await beginRecording(recordingId, metadata);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 3500000,
      });
      recorder.ondataavailable = (e) => {
        if (!e.data.size) return;
        const n = index++;
        bytes += e.data.size;
        writes = writes.then(() =>
          appendRecordingChunk(recordingId, n, e.data),
        );
        if (bytes > 50 * 1024 * 1024 && recorder.state === "recording")
          recorder.stop();
      };
      recorder.onstop = async () => {
        clearTimeout(timeout);
        clearTimeout(hardTimeout);
        audioContext?.close().catch(() => {});
        stream.getTracks().forEach((t) => t.stop());
        try {
          await writes;
          if (discard) {
            await discardRecording(recordingId);
            await chrome.runtime.sendMessage({
              type: "RECORD_FAILED",
              error:
                "Recording discarded because navigation left the approved site.",
            });
            return;
          }
          if (!(await finishRecording(recordingId)))
            throw new Error("The recording was empty.");
          await chrome.runtime.sendMessage({
            type: "RECORDED",
            id: recordingId,
          });
        } catch (e) {
          await chrome.runtime.sendMessage({
            type: "RECORD_FAILED",
            error: e.message,
          });
        }
      };
      clock = new RecordingClock();
      maxSeconds = Math.min(180, Math.max(15, Number(m.maxSeconds) || 60));
      recorder.start(1000);
      timeout = setTimeout(
        () => recorder.state !== "inactive" && recorder.stop(),
        maxSeconds * 1000,
      );
      hardTimeout = setTimeout(
        () => recorder.state !== "inactive" && recorder.stop(),
        600000,
      );
    } else if (m.type === "EVENT" && recorder?.state === "recording") {
      if (metadata.interactions.length < 500) {
        metadata.interactions.push({
          ...m.event,
          at: clock.elapsed(),
        });
        writes = writes.then(() => beginRecording(recordingId, metadata));
        await writes;
      }
    } else if (m.type === "PAUSE" && recorder?.state === "recording") {
      clock.pause();
      clearTimeout(timeout);
      recorder.pause();
    } else if (m.type === "RESUME" && recorder?.state === "paused") {
      clock.resume();
      recorder.resume();
      timeout = setTimeout(
        () => recorder.state !== "inactive" && recorder.stop(),
        Math.max(0, maxSeconds - clock.elapsed()) * 1000,
      );
    } else if (m.type === "STOP") {
      discard = !!m.discard;
      if (recorder && recorder.state !== "inactive") recorder.stop();
    }
    return true;
  })()
    .then((data) => reply({ ok: true, data }))
    .catch(async (e) => {
      stream?.getTracks().forEach((t) => t.stop());
      await chrome.runtime.sendMessage({
        type: "RECORD_FAILED",
        error: e.message,
      });
      reply({ ok: false, error: e.message });
    });
  return true;
});
