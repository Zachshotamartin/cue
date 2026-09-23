"use client";
import { type Snapshot } from "../../../../packages/contracts";
import { api } from "../client-api";
import { Button } from "../ui/Button";
import { useEditor } from "./EditorContext";

export function RecoveryBanner() {
  const {
    id,
    setDraft,
    setDirty,
    dirtyRef,
    conflict,
    recovery,
    setRecovery,
    baseRevision,
    draftRef,
    save,
    resolveSave,
    action,
  } = useEditor();
  return (
    <>
      <section className="recovery-banner" role="status">
        <p>
          {conflict
            ? "This project changed in another tab. Your edits are safe here. Choose which version to keep."
            : "This browser has edits that did not finish saving. Restore them, or keep the cloud version."}
        </p>
        <Button
          className="button small"
          onClick={() =>
            action("recover", async () => {
              if (recovery) {
                const latest = await api<Snapshot>(`/projects/${id}`);
                baseRevision.current = latest.project.revision;
                draftRef.current = recovery.draft;
                setDraft(recovery.draft);
                dirtyRef.current = true;
                setDirty(true);
                setRecovery(null);
                await save();
              } else await resolveSave(true);
            })
          }
        >
          {recovery ? "Restore my edits" : "Keep my edits"}
        </Button>
        <Button
          className="button small secondary"
          onClick={() =>
            action("recover", async () => {
              setRecovery(null);
              await resolveSave(false);
            })
          }
        >
          Use cloud version
        </Button>
      </section>
    </>
  );
}
