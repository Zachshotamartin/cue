import { interactionsSchema } from "../contracts/evidence";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { lockAccount } from "./client";
import { dataDir } from "./config";
import { writeObject, readObject, cloudObjects } from "./objects";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { addAsset, assets, now, project, projectStorage, tx } from "./db";
import type { Asset, CaptureMetadata } from "../contracts";
export const run = promisify(execFile);
export const maxBytes = 64 * 1024 * 1024;
export const hash = (buffer: Buffer | string) =>
  createHash("sha256").update(buffer).digest("hex");
export function assetPath(asset: Asset) {
  return path.join(dataDir, "assets", asset.path);
}
export async function readBounded(
  body: ReadableStream<Uint8Array> | null,
  limit = maxBytes,
) {
  if (!body) throw new Error("No file was received.");
  const reader = body.getReader(),
    chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit)
        throw new Error(
          `Upload exceeds ${Math.round(limit / 1024 / 1024)} MiB.`,
        );
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export async function inspect(file: string) {
  const { stdout } = await run(
    process.env.CUE_FFPROBE || ffprobe.path,
    [
      "-v",
      "error",
      "-protocol_whitelist",
      "file,pipe",
      "-show_format",
      "-show_streams",
      "-of",
      "json",
      file,
    ],
    { timeout: 20000, maxBuffer: 2 * 1024 * 1024 },
  );
  return JSON.parse(stdout);
}
function cleanMetadata(raw: CaptureMetadata): CaptureMetadata {
  const out: CaptureMetadata = {};
  for (const key of ["url", "title", "state", "text"])
    if (typeof raw[key] === "string")
      out[key] = String(raw[key]).slice(0, key === "text" ? 12000 : 2048);
  if (out.url) {
    try {
      const u = new URL(out.url);
      if (!["https:", "http:"].includes(u.protocol)) delete out.url;
      else {
        for (const k of [...u.searchParams.keys()])
          if (/token|secret|password|code|key|session/i.test(k))
            u.searchParams.delete(k);
        if (
          /access_token|id_token|refresh_token|authorization|session|password|secret/i.test(
            u.hash,
          )
        )
          u.hash = "";
        u.username = "";
        u.password = "";
        out.url = u.toString();
      }
    } catch {
      delete out.url;
    }
  }
  if (Array.isArray(raw.colors))
    out.colors = raw.colors
      .filter((c) => /^#[a-f0-9]{6}$/i.test(c))
      .slice(0, 12);
  if (Array.isArray(raw.warnings))
    out.warnings = raw.warnings
      .map(String)
      .map((s) => s.slice(0, 300))
      .slice(0, 10);
  if (
    raw.viewport &&
    Number.isFinite(raw.viewport.width) &&
    Number.isFinite(raw.viewport.height)
  )
    out.viewport = raw.viewport;
  if (raw.interactions)
    out.interactions = interactionsSchema.parse(raw.interactions);
  if (typeof raw.journey === "string") out.journey = raw.journey.slice(0, 1000);
  if (typeof raw.masks === "number") out.masks = raw.masks;
  const rights = z
    .object({
      credit: z.string().max(500),
      license: z.string().max(500),
      sourceUrl: z
        .string()
        .max(2048)
        .refine((v) => !v || /^https?:\/\//.test(v)),
    })
    .safeParse(raw.rights);
  if (rights.success) out.rights = rights.data;
  return out;
}
export async function importMedia(
  projectId: string,
  input: Buffer,
  name: string,
  metadata: CaptureMetadata = {},
): Promise<Asset> {
  await project(projectId);
  if (!input.length || input.length > maxBytes)
    throw new Error("Files must be between 1 byte and 64 MiB.");
  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 });
  let buffer = input,
    ext = "",
    mime = "",
    kind: Asset["kind"] = "image",
    width: number | undefined,
    height: number | undefined,
    duration: number | undefined;
  try {
    const m = await sharp(input, { limitInputPixels: 32_000_000 }).metadata();
    if (
      !["png", "jpeg", "webp", "avif"].includes(m.format || "") ||
      (m.pages || 1) > 1
    )
      throw new Error("Unsupported image.");
    const result = await sharp(input, { limitInputPixels: 32_000_000 })
      .rotate()
      .png()
      .toBuffer({ resolveWithObject: true });
    buffer = result.data;
    width = result.info.width;
    height = result.info.height;
    ext = "png";
    mime = "image/png";
  } catch {
    const header = input.subarray(0, 16),
      text = header.toString("ascii");
    if (!(
      text.startsWith("RIFF") ||
      text.startsWith("ID3") ||
      text.startsWith("fLaC") ||
      text.startsWith("OggS") ||
      (header.length >= 4 && header.readUInt32BE(0) === 0x1a45dfa3) ||
      text.slice(4, 8) === "ftyp" ||
      (header[0] === 0xff && (header[1]! & 0xe0) === 0xe0)
    ))
      throw new Error(
        "Choose a PNG, JPEG, WebP, AVIF, MP4, WebM, WAV, MP3, Ogg or FLAC file.",
      );
    const temp = path.join(dataDir, `inspect-${randomUUID()}`);
    const normalized = `${temp}.mp4`;
    await fs.writeFile(temp, input);
    try {
      let m = await inspect(temp);
      const v = m.streams?.find((s: any) => s.codec_type === "video");
      const a = m.streams?.find((s: any) => s.codec_type === "audio");
      if (v) {
        width = Number(v.width);
        height = Number(v.height);
        if (!width || !height || width * height > 16_000_000)
          throw new Error("Video dimensions are too large.");
        // Browser MediaRecorder WebM files commonly have no container duration.
        // Normalize them to seekable, widely playable H.264 before validation.
        if (text.slice(4, 8) !== "ftyp") {
          await run(
            process.env.CUE_FFMPEG || ffmpeg!,
            [
              "-v",
              "error",
              "-protocol_whitelist",
              "file,pipe",
              "-i",
              temp,
              "-map",
              "0:v:0",
              "-map",
              "0:a?",
              "-t",
              "601",
              "-vf",
              "scale=trunc(iw/2)*2:trunc(ih/2)*2",
              "-c:v",
              "libx264",
              "-preset",
              "fast",
              "-crf",
              "20",
              "-pix_fmt",
              "yuv420p",
              "-c:a",
              "aac",
              "-movflags",
              "+faststart",
              "-threads",
              "2",
              normalized,
            ],
            { timeout: 180000 },
          );
          m = await inspect(normalized);
          buffer = await fs.readFile(normalized);
        }
        kind = "video";
        ext = "mp4";
        mime = "video/mp4";
      } else if (a) {
        kind = "audio";
        ext = text.startsWith("RIFF")
          ? "wav"
          : text.startsWith("fLaC")
            ? "flac"
            : text.startsWith("OggS")
              ? "ogg"
              : text.slice(4, 8) === "ftyp"
                ? "m4a"
                : "mp3";
        mime =
          ext === "mp3"
            ? "audio/mpeg"
            : ext === "m4a"
              ? "audio/mp4"
              : `audio/${ext}`;
      } else throw new Error("No playable media stream found.");
      duration = Number(m.format?.duration);
      if (!Number.isFinite(duration) || duration <= 0 || duration > 600)
        throw new Error(
          "Media must have a valid duration of at most 10 minutes.",
        );
    } finally {
      await fs.unlink(temp).catch(() => {});
      await fs.unlink(normalized).catch(() => {});
    }
  }
  if (buffer.length > maxBytes)
    throw new Error(
      "The normalized media exceeds 64 MiB. Use a shorter or smaller recording.",
    );
  const owner = (await project(projectId)).owner;
  return tx(async () => {
    await lockAccount(owner);
    await project(projectId);
    const digest = hash(buffer),
      existing = (await assets(projectId)).find(
        (a) =>
          a.hash === digest &&
          a.name === name &&
          JSON.stringify(a.metadata) ===
            JSON.stringify({
              ...cleanMetadata(metadata),
              originalHash: hash(input),
            }),
      );
    if (existing) return existing;
    if ((await projectStorage(owner)) + buffer.length > 1024 * 1048576)
      throw new Error("Your account has reached its 1 GiB media limit.");
    const id = randomUUID(),
      relative = cloudObjects()
        ? `projects/${projectId}/assets/${id}.${ext}`
        : `${id}.${ext}`;
    if (cloudObjects()) await writeObject(relative, buffer, mime);
    else {
      await fs.mkdir(path.join(dataDir, "assets"), { recursive: true });
      await fs.writeFile(path.join(dataDir, "assets", relative), buffer, {
        flag: "wx",
      });
    }
    const asset: Asset = {
      id,
      projectId,
      kind,
      name: name.replace(/[\u0000-\u001f]/g, "").slice(0, 160),
      mime,
      bytes: buffer.length,
      width,
      height,
      duration,
      hash: digest,
      path: relative,
      metadata: { ...cleanMetadata(metadata), originalHash: hash(input) },
      createdAt: now(),
    };
    await addAsset(asset);
    return asset;
  });
}

export async function readAsset(asset: Asset) {
  return cloudObjects()
    ? readObject(asset.path)
    : fs.readFile(assetPath(asset));
}
