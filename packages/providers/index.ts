import fs from "node:fs/promises";
import sharp from "sharp";
import { readAsset, readBounded } from "../storage/media";
import { credential } from "../storage/credentials";
import { planJsonSchema } from "../director";
import {
  planners,
  plannerProviderSchema,
  type PlannerProvider,
  type Asset,
} from "../contracts";
export class ProviderError extends Error {
  constructor(
    message: string,
    public definitive = false,
    public billable = false,
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
  const key = await credential(owner, "runway");
  videoPrice(model, seconds);
  if (source.kind !== "image")
    throw new Error("Choose an image as the generation reference.");
  const ratio = format === "portrait" ? "720:1280" : "1280:720";
  const [width, height] = ratio.split(":").map(Number);
  const input = await sharp(await readAsset(source))
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
  const key = await credential(owner, "runway");
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
  const key = await credential(owner, "runway");
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
  model = plannerModel("gemini"),
) {
  const key = await credential(owner, "gemini");
  const imageParts = (await planningImages(assets)).flatMap((image) => [
    { text: image.label },
    { inlineData: { mimeType: "image/jpeg", data: image.data } },
  ]);
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
            { role: "user", parts: [{ text: prompt }, ...imageParts] },
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
  const data = await plannerResponse(r);
  if (
    data.promptFeedback?.blockReason ||
    (data.candidates?.[0]?.finishReason &&
      data.candidates[0].finishReason !== "STOP")
  )
    throw new ProviderError(
      "Gemini could not complete the storyboard. Your film is unchanged.",
      true,
      true,
    );
  const text = data.candidates?.[0]?.content?.parts
    ?.map((p: any) => p.text || "")
    .join("");
  return parsePlanText(text);
}

export function plannerModel(provider: PlannerProvider) {
  const envName = {
    gemini: "GEMINI_MODEL",
    openai: "OPENAI_PLANNER_MODEL",
    anthropic: "ANTHROPIC_PLANNER_MODEL",
  }[provider];
  const model = process.env[envName] || planners[provider].model;
  if (!/^[a-z0-9._-]{1,100}$/i.test(model))
    throw new Error("Invalid planner model name.");
  return model;
}

async function planningImages(assets: Asset[]) {
  return Promise.all(
    assets
      .filter((a) => a.kind === "image")
      .slice(0, 6)
      .map(async (asset) => ({
        label: `Reference image asset ID: ${asset.id}`,
        data: (
          await sharp(await readAsset(asset))
            .resize(960, 600, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 75 })
            .toBuffer()
        ).toString("base64"),
      })),
  );
}

async function plannerResponse(response: Response) {
  // Never include upstream bodies in user errors: they can contain private evidence.
  try {
    return JSON.parse(
      (await readBounded(response.body, 1024 * 1024)).toString("utf8"),
    );
  } catch {
    throw new ProviderError(
      "The planner returned an unreadable response. Your film is unchanged.",
      true,
      true,
    );
  }
}
function parsePlanText(text: unknown) {
  try {
    if (typeof text !== "string" || !text.trim()) throw new Error();
    const plan = JSON.parse(text);
    if (
      !plan ||
      typeof plan.description !== "string" ||
      plan.description.length > 2000 ||
      !Array.isArray(plan.shots) ||
      plan.shots.length < 4 ||
      plan.shots.length > 7 ||
      plan.shots.some(
        (shot: any) =>
          !shot ||
          typeof shot.duration !== "number" ||
          shot.duration < 3 ||
          shot.duration > 8,
      )
    )
      throw new Error();
    return plan;
  } catch {
    throw new ProviderError(
      "The planner returned an invalid storyboard. Your film is unchanged.",
      true,
      true,
    );
  }
}

// Claude's strict output grammar cannot express numeric bounds or 4–7 items.
// Keep them in field descriptions; Cue validates the proposal before saving it.
const claudePlanSchema = structuredClone(planJsonSchema);
const claudeShots: any = claudePlanSchema.properties.shots;
delete claudeShots.minItems;
delete claudeShots.maxItems;
claudeShots.description = "Return 4 to 7 scenes.";
delete claudeShots.items.properties.duration.minimum;
delete claudeShots.items.properties.duration.maximum;
claudeShots.items.properties.duration.description =
  "Scene duration in seconds, from 3 to 8.";

export async function planStoryboard(
  owner: string,
  prompt: string,
  assets: Asset[],
  provider: PlannerProvider = "gemini",
  model = plannerModel(provider),
) {
  plannerProviderSchema.parse(provider);
  if (provider === "gemini")
    return planWithGemini(owner, prompt, assets, model);
  const key = await credential(owner, provider);
  const images = await planningImages(assets);
  if (provider === "openai") {
    const response = await checked(
      await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          store: false,
          max_output_tokens: 10000,
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: prompt },
                ...images.flatMap((image) => [
                  { type: "input_text", text: image.label },
                  {
                    type: "input_image",
                    image_url: `data:image/jpeg;base64,${image.data}`,
                    detail: "high",
                  },
                ]),
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "cue_storyboard",
              strict: true,
              schema: planJsonSchema,
            },
          },
        }),
        signal: AbortSignal.timeout(90000),
      }),
    );
    const data = await plannerResponse(response);
    const content = (data.output || [])
      .filter(
        (item: any) => item.type === "message" && item.role === "assistant",
      )
      .flatMap((item: any) => item.content || []);
    if (
      data.status !== "completed" ||
      content.some((item: any) => item.type === "refusal")
    )
      throw new ProviderError(
        "OpenAI could not complete the storyboard. Your film is unchanged.",
        true,
        true,
      );
    return parsePlanText(
      content
        .filter((item: any) => item.type === "output_text")
        .map((item: any) => item.text)
        .join(""),
    );
  }
  const response = await checked(
    await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 6000,
        messages: [
          {
            role: "user",
            content: [
              ...images.flatMap((image) => [
                { type: "text", text: image.label },
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: image.data,
                  },
                },
              ]),
              { type: "text", text: prompt },
            ],
          },
        ],
        output_config: {
          format: { type: "json_schema", schema: claudePlanSchema },
        },
      }),
      signal: AbortSignal.timeout(90000),
    }),
  );
  const data = await plannerResponse(response);
  if (data.stop_reason !== "end_turn")
    throw new ProviderError(
      "Claude could not complete the storyboard. Your film is unchanged.",
      true,
      true,
    );
  return parsePlanText(
    (data.content || [])
      .filter((item: any) => item.type === "text")
      .map((item: any) => item.text)
      .join(""),
  );
}
export async function synthesize(owner: string, text: string, voiceId: string) {
  const key = await credential(owner, "elevenlabs");
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
