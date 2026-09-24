import { z } from "zod";

export const formatSchema = z.enum(["landscape", "portrait", "square"]);
export const providerSchema = z.enum([
  "runway",
  "gemini",
  "openai",
  "anthropic",
  "elevenlabs",
]);
export const plannerProviderSchema = z.enum(["gemini", "openai", "anthropic"]);
export type PlannerProvider = z.infer<typeof plannerProviderSchema>;
export const planners = {
  gemini: { label: "Gemini", model: "gemini-2.5-flash", reserveCents: 25 },
  openai: {
    label: "OpenAI (ChatGPT)",
    model: "gpt-5.4-mini",
    reserveCents: 25,
  },
  anthropic: { label: "Claude", model: "claude-sonnet-4-6", reserveCents: 25 },
} satisfies Record<
  PlannerProvider,
  { label: string; model: string; reserveCents: number }
>;
export function plannerLabel(value: unknown) {
  const parsed = plannerProviderSchema.safeParse(value);
  return planners[parsed.success ? parsed.data : "gemini"].label;
}
export const rectSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .refine(
    (r) => r.x + r.width <= 1.001 && r.y + r.height <= 1.001,
    "Crop must fit inside the source.",
  );
export const shotSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(100),
  purpose: z.string().max(250).default(""),
  evidenceIds: z.array(z.string()).max(12).default([]),
  assetId: z.string().nullable(),
  secondaryAssetId: z.string().nullable().default(null),
  template: z.enum([
    "reveal",
    "showcase",
    "closeup",
    "comparison",
    "atmosphere",
    "endcard",
  ]),
  mode: z.enum(["exact-ui", "generated-video", "hybrid"]),
  duration: z
    .number()
    .min(1)
    .max(20)
    .transform((seconds) => Math.round(seconds * 30) / 30),
  caption: z.string().max(140),
  narration: z.string().max(1200).default(""),
  narrationAssetId: z.string().nullable().default(null),
  prompt: z.string().max(1000),
  motion: z.enum(["push", "pull", "pan", "float", "still"]),
  focalRect: rectSchema.default({ x: 0, y: 0, width: 1, height: 1 }),
  selectedTakeId: z.string().nullable().default(null),
  trimStart: z.number().min(0).max(600).default(0),
  playbackRate: z.number().min(0.5).max(3).default(1),
  sourceAudioVolume: z.number().min(0).max(1).default(0),
  locked: z.boolean().default(false),
  action: z.string().max(250).default(""),
  outcome: z.string().max(250).default(""),
  presentation: z.enum(["framed", "full"]).default("framed"),
  focalEnd: rectSchema.nullable().default(null),
  emphasis: z
    .array(
      z.object({
        at: z.number().min(0).max(20),
        duration: z.number().min(0.2).max(10).default(1.5),
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        label: z.string().max(80).default(""),
      }),
    )
    .max(20)
    .default([]),
  speechCues: z
    .array(
      z
        .object({
          start: z.number().min(0),
          end: z.number().positive(),
          text: z.string().max(200),
        })
        .refine((c) => c.end > c.start, "Caption end must follow its start"),
    )
    .max(100)
    .default([]),
  background: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default("#181a19"),
  transition: z.enum(["cut", "fade"]).default("fade"),
});
export const brandSchema = z.object({
  accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  background: z.string().regex(/^#[0-9a-f]{6}$/i),
  foreground: z.string().regex(/^#[0-9a-f]{6}$/i),
  logoAssetId: z.string().nullable(),
  font: z.enum(["Manrope", "Arial", "Georgia"]),
});
export const draftSchema = z.object({
  version: z.literal(2).default(2),
  productName: z.string().max(100).default(""),
  objective: z.enum(["auto", "demonstration", "teaser"]).default("auto"),
  targetSeconds: z.number().int().min(15).max(90).default(30),
  channel: z.enum(["website", "social", "presentation"]).default("website"),
  features: z.array(z.string().max(150)).max(8).default([]),
  journey: z.string().max(1000).default(""),
  ctaUrl: z.string().max(2048).default(""),
  narrationVoiceId: z.string().max(80).default(""),
  pronunciationDictionaries: z
    .array(
      z.object({
        pronunciation_dictionary_id: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[\w-]+$/),
        version_id: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[\w-]+$/),
      }),
    )
    .max(3)
    .default([]),
  soundCues: z
    .array(
      z.object({
        id: z.string(),
        assetId: z.string(),
        at: z.number().min(0).max(600),
        trimStart: z.number().min(0).max(600).default(0),
        duration: z.number().min(0.1).max(60),
        volume: z.number().min(0).max(1).default(0.3),
        fade: z.number().min(0).max(3).default(0.2),
      }),
    )
    .max(40)
    .default([]),
  title: z.string().min(1).max(100),
  siteUrl: z.string().max(2048),
  audience: z.string().max(500),
  description: z.string().max(2000),
  cta: z.string().max(120),
  format: formatSchema,
  treatment: z.enum(["editorial", "energetic", "minimal"]),
  plannerProvider: plannerProviderSchema.default("gemini"),
  excludedAssetIds: z.array(z.string()).max(300).default([]),
  brand: brandSchema,
  shots: z.array(shotSchema).max(30),
  musicAssetId: z.string().nullable(),
  musicVolume: z.number().min(0).max(1),
  budgetCents: z.number().int().min(0).max(100000),
});
export type Shot = z.infer<typeof shotSchema>;
export type Draft = z.infer<typeof draftSchema>;
export type Provider = z.infer<typeof providerSchema>;
export type Asset = {
  id: string;
  projectId: string;
  kind: "image" | "video" | "audio";
  name: string;
  mime: string;
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;
  hash: string;
  path: string;
  metadata: CaptureMetadata;
  createdAt: string;
};
export type CaptureMetadata = {
  url?: string;
  title?: string;
  state?: string;
  text?: string;
  colors?: string[];
  viewport?: { width: number; height: number };
  masks?: number;
  warnings?: string[];
  [key: string]: unknown;
};
export type Project = {
  id: string;
  owner: string;
  revision: number;
  draft: Draft;
  createdAt: string;
  updatedAt: string;
};
export type Job = {
  id: string;
  projectId: string;
  kind:
    | "plan"
    | "generate"
    | "render"
    | "narrate"
    | "redact"
    | "analyze"
    | "music"
    | "sound";
  state:
    | "queued"
    | "submitting"
    | "running"
    | "retrieving"
    | "completed"
    | "failed"
    | "cancelled"
    | "unknown";
  progress: number;
  payload: Record<string, any>;
  inputHash?: string;
  providerTaskId: string | null;
  workflowId?: string;
  sandboxId?: string;
  commandId?: string;
  error: string | null;
  outputAssetId: string | null;
  reservedCents: number;
  chargedCents: number;
  cancelRequested: boolean;
  leaseUntil: number;
  createdAt: string;
  updatedAt: string;
};
export type Take = {
  id: string;
  projectId: string;
  shotId: string;
  assetId: string;
  jobId: string;
  prompt: string;
  model: string;
  sourceHash: string;
  createdAt: string;
};
export type Snapshot = {
  project: Project;
  assets: Asset[];
  jobs: Job[];
  takes: Take[];
  revisions: { revision: number; label: string; createdAt: string }[];
  budget: { spent: number; reserved: number; limit: number };
  eventsCursor: number;
};
export const createProjectSchema = z.object({
  title: z.string().min(1).max(100),
  siteUrl: z.string().max(2048).default(""),
});
export const editSchema = z.object({
  revision: z.number().int().positive(),
  draft: draftSchema,
  label: z.string().max(100).default("Edit project"),
});
export function dimensions(format: Draft["format"]) {
  return format === "portrait"
    ? { width: 1080, height: 1920 }
    : format === "square"
      ? { width: 1080, height: 1080 }
      : { width: 1920, height: 1080 };
}
export function defaultDraft(title: string, siteUrl = ""): Draft {
  return draftSchema.parse({
    title,
    siteUrl,
    audience: "People discovering your product",
    description: "",
    cta: siteUrl ? new URL(siteUrl).hostname : "See what you can make.",
    format: "landscape",
    treatment: "editorial",
    plannerProvider: "gemini",
    excludedAssetIds: [],
    brand: {
      accent: "#df603c",
      background: "#181a19",
      foreground: "#f3f3ee",
      logoAssetId: null,
      font: "Manrope",
    },
    shots: [],
    musicAssetId: null,
    musicVolume: 0.16,
    budgetCents: 1000,
  });
}
export function durationFrames(draft: Draft, fps = 30) {
  return Math.max(
    1,
    draft.shots.reduce((n, s) => n + Math.round(s.duration * fps), 0),
  );
}
