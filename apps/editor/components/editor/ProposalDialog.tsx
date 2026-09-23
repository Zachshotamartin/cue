"use client";
import { Check } from "@phosphor-icons/react";
import { plannerLabel, type Shot } from "../../../../packages/contracts";
import { api } from "../client-api";
import { Button } from "../ui/Button";
import { useEditor } from "./EditorContext";
import { Modal } from "../ui/Modal";
import { ProposalScene } from "./ProposalScene";

export function ProposalDialog() {
  const {
    id,
    busy,
    showProposal,
    setShowProposal,
    action,
    savedRevision,
    proposals,
  } = useEditor();
  return (
    <>
      <Modal
        className="proposal-modal"
        label="AI storyboard proposal"
        onClose={() => setShowProposal(null)}
      >
        <h2>A proposed direction.</h2>
        <p className="eyebrow">
          {plannerLabel(
            proposals.find((j) => j.id === showProposal)?.payload.provider,
          )}{" "}
          proposal
        </p>
        <p>
          Check every product claim against the source screens. Review these
          scenes before replacing your timeline. Your current version stays in
          history.
        </p>
        {proposals
          .find((j) => j.id === showProposal)
          ?.payload.result.shots.map((s: Shot, i: number) => (
            <ProposalScene key={s.id || i} s={s} i={i} />
          ))}
        <Button
          className="button"
          disabled={!!busy}
          onClick={() =>
            action("apply", async () => {
              const revision = await savedRevision();
              await api(`/projects/${id}/apply-plan`, {
                method: "POST",
                body: JSON.stringify({ revision, jobId: showProposal }),
              });
              setShowProposal(null);
            })
          }
        >
          Use this storyboard <Check size={17} />
        </Button>
      </Modal>
    </>
  );
}
