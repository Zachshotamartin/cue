import { z } from "zod";
export const interactionSchema = z.object({
  at: z.number().min(0).max(600),
  type: z.enum([
    "click",
    "scroll",
    "navigation",
    "result",
    "marker",
    "focus",
    "pointer",
  ]),
  label: z.string().max(100).default(""),
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
});
export const interactionsSchema = z.array(interactionSchema).max(500);
export type Interaction = z.infer<typeof interactionSchema>;
export type EvidenceAnalysis = {
  version: 2;
  sourceHash: string;
  frames: { at: number; path: string }[];
  segments: {
    start: number;
    end: number;
    label: string;
    event?: Interaction;
  }[];
  warnings: string[];
};
export function sampleTimes(
  duration: number,
  events: Interaction[],
  limit = 12,
  visualChanges: number[] = [],
) {
  const end = Math.max(0, duration - 0.1);
  const times = [0, end];
  for (const e of events
    .filter((e) => ["click", "result", "marker", "navigation"].includes(e.type))
    .slice(0, 4))
    times.push(
      Math.max(0, e.at - 0.5),
      Math.min(end, e.at + 0.6),
      Math.min(end, e.at + 2),
    );
  for (const at of visualChanges.slice(0, 6))
    times.push(Math.max(0, at - 0.5), Math.min(end, at + 0.5));
  for (let i = 1; i <= 8; i++) times.push((end * i) / 9);
  const unique: number[] = [];
  for (const t of times)
    if (!unique.some((x) => Math.abs(x - t) < 0.35))
      unique.push(Math.round(t * 100) / 100);
  return unique.slice(0, limit).sort((a, b) => a - b);
}
