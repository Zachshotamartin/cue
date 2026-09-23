import {
  beginRecording,
  appendRecordingChunk,
  finishRecording,
  discardRecording,
} from "./shared.js";
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
      if (recorder?.state === "recording")
        throw new Error("Already recording.");
      discard = false;
      bytes = 0;
      index = 0;
      writes = Promise.resolve();
      recordingId = crypto.randomUUID();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: "tab",
            chromeMediaSourceId: m.streamId,
            maxFrameRate: 30,
          },
        },
      });
      await beginRecording(recordingId, m.metadata);
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
      recorder.start(1000);
      timeout = setTimeout(
        () => recorder.state === "recording" && recorder.stop(),
        60000,
      );
    } else if (m.type === "STOP") {
      discard = !!m.discard;
      if (recorder?.state === "recording") recorder.stop();
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
