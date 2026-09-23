import { z } from "zod";

export const formatSchema = z.enum(["landscape", "portrait", "square"]);
export const providerSchema = z.enum(["runway", "gemini", "elevenlabs"]);
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
  title: z.string().min(1).max(100),
  siteUrl: z.string().max(2048),
  audience: z.string().max(500),
  description: z.string().max(2000),
  cta: z.string().max(120),
  format: formatSchema,
  treatment: z.enum(["editorial", "energetic", "minimal"]),
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
  kind: "plan" | "generate" | "render" | "narrate";
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
  return {
    title,
    siteUrl,
    audience: "People discovering your product",
    description: "",
    cta: siteUrl ? new URL(siteUrl).hostname : "See what you can make.",
    format: "landscape",
    treatment: "editorial",
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
  };
}
export function durationFrames(draft: Draft, fps = 30) {
  return Math.max(
    1,
    draft.shots.reduce((n, s) => n + Math.round(s.duration * fps), 0),
  );
}
