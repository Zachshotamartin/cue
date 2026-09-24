import ffmpeg from "ffmpeg-static";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { Asset } from "../contracts";
import {
  type EvidenceAnalysis,
  interactionsSchema,
  sampleTimes,
} from "../contracts/evidence";
import { dataDir } from "../storage/config";
import { updateAssetMetadata } from "../storage/db";
import { readAsset, run } from "../storage/media";
import { readObject, writeObject } from "../storage/objects";

export function analysisCurrent(asset: Asset) {
  const a = asset.metadata.analysis as EvidenceAnalysis | undefined;
  return a?.version === 2 && a.sourceHash === asset.hash;
}
export async function analyzeAsset(asset: Asset): Promise<Asset> {
  if (asset.kind !== "video") return asset;
  if (analysisCurrent(asset)) return asset;
  const events = interactionsSchema.parse(asset.metadata.interactions || []);
  const duration = asset.duration || 0;
  if (!duration)
    throw new Error("The recording has no duration. Import it again.");
  await fs.mkdir(dataDir, { recursive: true });
  const folder = await fs.mkdtemp(path.join(dataDir, "analysis-"));
  try {
    const input = path.join(folder, "input.mp4");
    await fs.writeFile(input, await readAsset(asset));
    const scan = await run(
      process.env.CUE_FFMPEG || ffmpeg!,
      [
        "-hide_banner",
        "-protocol_whitelist",
        "file,pipe",
        "-i",
        input,
        "-an",
        "-vf",
        "fps=2,scale=160:-2,select=gt(scene\\,0.06),showinfo",
        "-frames:v",
        "24",
        "-f",
        "null",
        "-",
      ],
      { timeout: 45000, maxBuffer: 1048576 },
    );
    const changes = [...scan.stderr.matchAll(/pts_time:([\d.]+)/g)]
      .map((m) => Number(m[1]))
      .filter((n) => n > 0 && n < duration);
    const frames: EvidenceAnalysis["frames"] = [];
    for (const at of sampleTimes(duration, events, 12, changes)) {
      const out = path.join(folder, `${randomUUID()}.jpg`);
      await run(
        process.env.CUE_FFMPEG || ffmpeg!,
        [
          "-v",
          "error",
          "-protocol_whitelist",
          "file,pipe",
          "-ss",
          String(at),
          "-i",
          input,
          "-frames:v",
          "1",
          "-vf",
          "scale=960:600:force_original_aspect_ratio=decrease",
          "-threads",
          "1",
          "-y",
          out,
        ],
        { timeout: 20000 },
      );
      const key = `projects/${asset.projectId}/analysis/${asset.hash}/v2/${at}.jpg`;
      await writeObject(key, await fs.readFile(out), "image/jpeg", true);
      frames.push({ at, path: key });
    }
    const markers = events
      .filter((e) =>
        ["click", "result", "marker", "navigation"].includes(e.type),
      )
      .slice(0, 24);
    const analysis: EvidenceAnalysis = {
      version: 2,
      sourceHash: asset.hash,
      frames,
      segments: (markers.length
        ? markers
        : (changes.length
            ? changes.map((at) => ({ at }))
            : frames.slice(1, -1)
          ).map((f) => ({
            at: f.at,
            label: changes.length
              ? "Visible screen change — review the result"
              : "Review this moment",
            type: "marker" as const,
          }))
      ).map((event) => ({
        start: Math.max(0, event.at - 0.7),
        end: Math.min(duration, event.at + 3.5),
        label: event.label || event.type,
        event,
      })),
      warnings: markers.length
        ? []
        : [
            "No interaction markers. Review the suggested source timing before applying the story.",
          ],
    };
    return await updateAssetMetadata(asset.id, { analysis });
  } finally {
    await fs.rm(folder, { recursive: true, force: true });
  }
}

export async function visualEvidence(assets: Asset[]) {
  const groups: { label: string; load: () => Promise<string> }[][] = [];
  for (const asset of assets.slice(0, 12)) {
    if (asset.kind === "image") {
      groups.push([
        {
          label: `Source asset ${asset.id}, still image`,
          load: async () =>
            (
              await sharp(await readAsset(asset))
                .resize(1200, 800, { fit: "inside", withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toBuffer()
            ).toString("base64"),
        },
      ]);
    } else if (asset.kind === "video") {
      const analysis = asset.metadata.analysis as EvidenceAnalysis | undefined;
      if (!analysis || !analysisCurrent(asset))
        throw new Error("Analyze recordings before asking for a storyboard.");
      groups.push(
        analysis.frames.map((frame) => ({
          label: `Source asset ${asset.id}, recording frame at ${frame.at}s of ${asset.duration}s`,
          load: async () => (await readObject(frame.path)).toString("base64"),
        })),
      );
    }
  }
  // Round-robin sampling prevents the first long recording from consuming all evidence.
  const result: { label: string; data: string }[] = [];
  for (let i = 0; i < 12 && result.length < 24; i++)
    for (const group of groups)
      if (group[i] && result.length < 24)
        result.push({ label: group[i].label, data: await group[i].load() });
  return result;
}
