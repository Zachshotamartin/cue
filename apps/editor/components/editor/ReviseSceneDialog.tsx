"use client";
import { useState } from "react";
import { useEditor } from "./EditorContext";
import { Modal } from "../ui/Modal";
import { Textarea } from "../ui/Textarea";
import { Button } from "../ui/Button";
import { api, jobOptions, money } from "../client-api";
import { planners } from "../../../../packages/contracts";
export function ReviseSceneDialog({ onClose }: { onClose: () => void }) {
  const { id, shot, draft, savedRevision, action, busy } = useEditor(),
    [instruction, setInstruction] = useState("");
  if (!shot) return null;
  return (
    <Modal labelledBy="revise-title" onClose={onClose}>
      <h2 id="revise-title">Revise “{shot.title}”</h2>
      <p>
        Ask for alternatives for this scene. Your other scenes, sound and
        purchased takes stay in the project. You review the alternatives before
        applying one.
      </p>
      <label>
        What should change?
        <Textarea
          maxLength={600}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Show the result longer; zoom into the completed task; use a shorter caption…"
        />
      </label>
      <p>
        Uses {planners[draft.plannerProvider].label}. Reserves{" "}
        {money(planners[draft.plannerProvider].reserveCents)} against your film
        budget.
      </p>
      <Button
        className="button"
        disabled={!!busy || !instruction.trim() || shot.locked}
        onClick={() =>
          action("revise", async () => {
            const revision = await savedRevision();
            await api(
              `/projects/${id}/plan`,
              jobOptions({
                revision,
                provider: draft.plannerProvider,
                scopeShotId: shot.id,
                instruction,
              }),
            );
            onClose();
          })
        }
      >
        Propose scene alternatives
      </Button>
      {shot.locked && <p>Unlock this scene first to revise it.</p>}
    </Modal>
  );
}
