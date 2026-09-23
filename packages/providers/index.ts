import fs from "node:fs/promises";
import sharp from "sharp";
import { assetPath, readBounded } from "../storage/media";
import { credential } from "../storage/credentials";
import { planJsonSchema } from "../director";
import type { Asset } from "../contracts";
export class ProviderError extends Error {
  constructor(
    message: string,
    public definitive = false,
  ) {
    super(message);
  }
}
async function checked(response: Response) {
  if (!response.ok)
    throw new ProviderError(
      `Provider request failed (${response.status}). Check the key, account balance and model access.`,
      response.status >= 400 &&
        response.status < 500 &&
        response.status !== 408,
    );
  return response;
}
export const videoModels = {
  gen4_turbo: { seconds: [5, 10], centsPerSecond: 5 },
  "gen4.5": { seconds: [5, 10], centsPerSecond: 12 },
} as const;
export function videoPrice(model: string, seconds: number) {
  if (!(model in videoModels)) throw new Error("Unsupported video model.");
  const m = videoModels[model as keyof typeof videoModels];
  if (!(m.seconds as readonly number[]).includes(seconds))
    throw new Error("Select a supported generation duration.");
  return m.centsPerSecond * seconds;
}
export async function submitVideo(
  owner: string,
  source: Asset,
  prompt: string,
  model: string,
  seconds: number,
  format: string,
) {
  const key = credential(owner, "runway");
  videoPrice(model, seconds);
  if (source.kind !== "image")
    throw new Error("Choose an image as the generation reference.");
  const ratio = format === "portrait" ? "720:1280" : "1280:720";
  const [width, height] = ratio.split(":").map(Number);
  const input = await sharp(assetPath(source))
    .resize(width, height, { fit: "contain", background: "#181a19" })
    .jpeg({ quality: 90 })
    .toBuffer();
  const response = await checked(
    await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "X-Runway-Version": "2024-11-06",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        promptImage: `data:image/jpeg;base64,${input.toString("base64")}`,
        promptText: prompt,
        ratio,
        duration: seconds,
      }),
      signal: AbortSignal.timeout(60000),
    }),
  );
  const data = await response.json();
  if (typeof data.id !== "string")
    throw new ProviderError(
      "Provider accepted the request but did not return a task ID.",
    );
  return data.id as string;
}
export async function pollVideo(owner: string, id: string) {
  const key = credential(owner, "runway");
  return (
    await checked(
      await fetch(
        `https://api.dev.runwayml.com/v1/tasks/${encodeURIComponent(id)}`,
        {
          headers: {
            Authorization: `Bearer ${key}`,
            "X-Runway-Version": "2024-11-06",
          },
          signal: AbortSignal.timeout(25000),
        },
      ),
    )
  ).json();
}
export async function cancelVideo(owner: string, id: string) {
  const key = credential(owner, "runway");
  await checked(
    await fetch(
      `https://api.dev.runwayml.com/v1/tasks/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${key}`,
          "X-Runway-Version": "2024-11-06",
        },
        signal: AbortSignal.timeout(25000),
      },
    ),
  );
}
export async function downloadOutput(url: string) {
  const u = new URL(url);
  if (
    u.protocol !== "https:" ||
    !["runwayml.com", "cloudfront.net", "amazonaws.com"].some(
      (d) => u.hostname === d || u.hostname.endsWith(`.${d}`),
    )
  )
    throw new Error("Provider returned an unexpected output host.");
  const r = await checked(
    await fetch(url, { redirect: "error", signal: AbortSignal.timeout(90000) }),
  );
  return readBounded(r.body);
}
export async function planWithGemini(
  owner: string,
  prompt: string,
  assets: Asset[],
) {
  const key = credential(owner, "gemini");
  const imageParts = await Promise.all(
    assets
      .filter((a) => a.kind === "image")
      .slice(0, 6)
      .map(async (a) => [
        { text: `Reference image asset ID: ${a.id}` },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: (
              await sharp(assetPath(a))
                .resize(960, 600, { fit: "inside" })
                .jpeg({ quality: 75 })
                .toBuffer()
            ).toString("base64"),
          },
        },
      ]),
  );
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  if (!/^[a-z0-9.-]+$/i.test(model))
    throw new Error("Invalid planner model name.");
  const r = await checked(
    await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: prompt }, ...imageParts.flat()] },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: planJsonSchema,
            maxOutputTokens: 6000,
            temperature: 0.65,
          },
        }),
        signal: AbortSignal.timeout(90000),
      },
    ),
  );
  const data = await r.json();
  const text = data.candidates?.[0]?.content?.parts
    ?.map((p: any) => p.text || "")
    .join("");
  if (!text) throw new ProviderError("The planner returned no storyboard.");
  return JSON.parse(text);
}
export async function synthesize(owner: string, text: string, voiceId: string) {
  const key = credential(owner, "elevenlabs");
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(voiceId))
    throw new Error("Choose a valid ElevenLabs voice ID.");
  const r = await checked(
    await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
      signal: AbortSignal.timeout(90000),
    }),
  );
  return readBounded(r.body, 12 * 1024 * 1024);
}
