import { draftSchema, type Draft } from "../contracts";
export function replaceScene(
  current: Draft,
  base: Draft,
  proposed: Draft,
  scopeId: string,
  chosenId: string,
) {
  const index = current.shots.findIndex((s) => s.id === scopeId),
    before = base.shots.find((s) => s.id === scopeId),
    chosen = proposed.shots.find((s) => s.id === chosenId);
  if (index < 0 || !before || !chosen)
    throw Error("The source scene or proposed alternative no longer exists.");
  if (
    current.shots[index].locked ||
    JSON.stringify(current.shots[index]) !== JSON.stringify(before)
  )
    throw Error(
      "This scene changed after planning. Request alternatives from the latest edit.",
    );
  const shots = [...current.shots];
  shots[index] = structuredClone(chosen);
  return draftSchema.parse({ ...current, shots });
}

/** Keep approved scenes at their existing indices and leave non-story edits alone. */
export function mergeStory(current: Draft, proposed: Draft): Draft {
  const locked = current.shots.filter((s) => s.locked);
  const replacement = proposed.shots.filter(
    (s) => !locked.some((l) => l.id === s.id),
  );
  const shots = [...replacement];
  current.shots.forEach((shot, index) => {
    if (shot.locked)
      shots.splice(Math.min(index, shots.length), 0, structuredClone(shot));
  });
  if (shots.length > 30)
    throw new Error(
      "The new story and locked scenes exceed 30 scenes. Unlock or remove a scene first.",
    );
  return draftSchema.parse({ ...current, shots });
}
