"use client";
import { useState } from "react";
import { useEditor } from "./EditorContext";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { api } from "../client-api";
export function MediaCleanupDialog({ onClose }: { onClose: () => void }) {
  const { id, savedRevision, action, busy, snap, setNotice } = useEditor(),
    [confirm, setConfirm] = useState(false);
  const bytes = snap.assets.reduce((n, a) => n + a.bytes, 0);
  return (
    <Modal labelledBy="cleanup-title" onClose={onClose}>
      <h2 id="cleanup-title">Clean old media & history</h2>
      <p>
        This film references {(bytes / 1048576).toFixed(1)} MiB of media.
        Cleanup keeps the current edit, its sources and selected takes, and all
        saved exports. It removes previous revisions, unused uploads and
        unselected generated takes.
      </p>
      <p>
        Download the portable archive first if you may want those alternatives
        again.
      </p>
      <label>
        <Input
          type="checkbox"
          checked={confirm}
          onChange={(e) => setConfirm(e.target.checked)}
        />
        I understand old edits and unused media will be permanently removed.
      </label>
      <Button
        className="button"
        disabled={!confirm || !!busy}
        onClick={() =>
          action("cleanup", async () => {
            const revision = await savedRevision();
            const result = await api(`/projects/${id}/cleanup`, {
              method: "POST",
              body: JSON.stringify({ revision, confirm: "DELETE OLD HISTORY" }),
            });
            setNotice(
              `Removed ${result.removed} unused media entries. Shared files stay available to other films.`,
            );
            onClose();
          })
        }
      >
        Clean history
      </Button>
    </Modal>
  );
}
