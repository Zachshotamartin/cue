"use client";
import { useEditor } from "./EditorContext";
import { evidenceAssets } from "../../../../packages/director/evidence";
import { Button } from "../ui/Button";
export function CapturePlan() {
  const { draft, sceneAssets, mutate, setNotice } = useEditor();
  const recordings = evidenceAssets(draft, sceneAssets).filter(
    (a) =>
      a.kind === "video" &&
      !a.metadata.privacyPending &&
      !a.metadata.supersededBy,
  );
  const steps = [
    "Show the starting state",
    ...draft.features.filter(Boolean).map((f) => `Demonstrate ${f}`),
    "Complete the primary task",
    "Hold on the visible result",
  ];
  return (
    <section className="capture-plan">
      <h3>Record the story</h3>
      <p>
        {draft.journey ||
          "Capture a real task from its starting state through the result. Keep loading and waiting out of the finished sequence."}
      </p>
      <ol>
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="field-help">
        {recordings.length
          ? `${recordings.length} workflow recording${recordings.length === 1 ? "" : "s"} ready to analyze. Confirm each promised feature is visible.`
          : "A product demonstration needs a workflow recording. Screenshots alone can make a teaser."}
      </p>
      <Button
        className="text-link"
        onClick={() => {
          mutate((d) => {
            d.journey = steps.join("\n");
          });
          setNotice(
            "Capture checklist saved in the brief. Pair again to send it to the extension.",
          );
        }}
      >
        Use this checklist
      </Button>
    </section>
  );
}
