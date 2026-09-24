import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";
import { z } from "zod";
import { rectSchema, type Asset } from "../contracts";
import { dataDir } from "./config";
import { importMedia, readAsset, run } from "./media";
import { updateAssetMetadata } from "./db";
export const redactionSchema = z.object({
  assetId: z.string(),
  regions: z.array(rectSchema).min(1).max(20),
  removeAudio: z.boolean().default(true),
});
export function pixelMask(
  region: z.infer<typeof rectSchema>,
  width: number,
  height: number,
) {
  const left = Math.min(width - 1, Math.floor(width * region.x));
  const top = Math.min(height - 1, Math.floor(height * region.y));
  return {
    left,
    top,
    width: Math.max(
      1,
      Math.min(
        width - left,
        Math.ceil(width * (region.x + region.width)) - left,
      ),
    ),
    height: Math.max(
      1,
      Math.min(
        height - top,
        Math.ceil(height * (region.y + region.height)) - top,
      ),
    ),
  };
}
export async function redactMedia(source: Asset, raw: unknown) {
  const { regions, removeAudio } = redactionSchema.parse(raw);
  if (!source.width || !source.height || source.kind === "audio")
    throw Error("Choose a screenshot or recording to redact.");
  const boxes = regions.map((r) => pixelMask(r, source.width!, source.height!));
  let bytes: Buffer;
  if (source.kind === "image") {
    const overlays = boxes.map(({ left, top, width, height }) => ({
      input: Buffer.from(
        `<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="black"/></svg>`,
      ),
      left,
      top,
    }));
    bytes = await sharp(await readAsset(source))
      .composite(overlays)
      .png()
      .toBuffer();
  } else {
    await fs.mkdir(dataDir, { recursive: true });
    const folder = await fs.mkdtemp(path.join(dataDir, "redact-"));
    try {
      const input = path.join(folder, "source.mp4"),
        output = path.join(folder, "redacted.mp4");
      await fs.writeFile(input, await readAsset(source));
      const filters = boxes
        .map(
          (b) =>
            `drawbox=x=${b.left}:y=${b.top}:w=${b.width}:h=${b.height}:color=black:t=fill`,
        )
        .join(",");
      await run(
        process.env.CUE_FFMPEG || ffmpeg!,
        [
          "-v",
          "error",
          "-protocol_whitelist",
          "file,pipe",
          "-i",
          input,
          "-vf",
          filters,
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "20",
          "-threads",
          "2",
          ...(removeAudio ? ["-an"] : ["-c:a", "aac"]),
          "-movflags",
          "+faststart",
          "-y",
          output,
        ],
        { timeout: 180000, maxBuffer: 1048576 },
      );
      bytes = await fs.readFile(output);
    } finally {
      await fs.rm(folder, { recursive: true, force: true });
    }
  }
  const result = await importMedia(
    source.projectId,
    bytes,
    `redacted-${source.id}.${source.kind === "image" ? "png" : "mp4"}`,
    {
      state: "Redacted source",
      masks: regions.length,
      warnings: [
        "Review the entire safe copy. Static masks do not follow moving content.",
      ],
    },
  );
  await updateAssetMetadata(source.id, {
    privacyPending: false,
    supersededBy: result.id,
  });
  return result;
}
