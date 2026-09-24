import fs from "node:fs/promises";
import ffmpeg from "ffmpeg-static";
import { inspect, run } from "../storage/media";
/** Shared by local and hosted renders: identical final audio and media checks. */
export async function finalizeFilm(
  file: string,
  expected: { width: number; height: number; duration: number },
) {
  let info = await inspect(file);
  if (info.streams?.some((s: any) => s.codec_type === "audio")) {
    const output = `${file}.normalized.mp4`;
    try {
      const ff = process.env.CUE_FFMPEG || ffmpeg!;
      const measured = await run(
        ff,
        [
          "-hide_banner",
          "-i",
          file,
          "-af",
          "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
          "-f",
          "null",
          "-",
        ],
        { timeout: 180000, maxBuffer: 1048576 },
      );
      const stats = JSON.parse(
        measured.stderr.slice(measured.stderr.lastIndexOf("{")),
      );
      const values = [
        "input_i",
        "input_tp",
        "input_lra",
        "input_thresh",
        "target_offset",
      ].map((k) => Number(stats[k]));
      // Silence has -inf measurements. Avoid producing an invalid normalization filter.
      const filter = values.every(Number.isFinite)
        ? `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${values[0]}:measured_TP=${values[1]}:measured_LRA=${values[2]}:measured_thresh=${values[3]}:offset=${values[4]}:linear=true`
        : "alimiter=limit=0.8414:level=false";
      await run(
        ff,
        [
          "-v",
          "error",
          "-i",
          file,
          "-c:v",
          "copy",
          "-af",
          filter,
          "-ar",
          "48000",
          "-t",
          String(expected.duration),
          "-c:a",
          "aac",
          "-movflags",
          "+faststart",
          "-y",
          output,
        ],
        { timeout: 180000 },
      );
      await fs.rename(output, file);
    } finally {
      await fs.unlink(output).catch(() => {});
    }
    info = await inspect(file);
  }
  const video = info.streams?.find((s: any) => s.codec_type === "video"),
    duration = Number(info.format?.duration);
  if (video?.width !== expected.width || video?.height !== expected.height)
    throw Error("The exported resolution failed validation.");
  if (
    !Number.isFinite(duration) ||
    Math.abs(duration - expected.duration) > 0.2
  )
    throw Error("The exported duration failed validation.");
  return info;
}
