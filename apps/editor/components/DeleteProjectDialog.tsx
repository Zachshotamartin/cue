"use client";
import { useState } from "react";
import { Modal } from "./ui/Modal";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { api } from "./client-api";
export function DeleteProjectDialog({
  id,
  title,
  onClose,
  onDeleted,
}: {
  id: string;
  title: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal labelledBy="delete-project-title" onClose={onClose}>
      <h2 id="delete-project-title">Delete this film?</h2>
      <p>
        This removes its revisions, captures, generated takes and exports.
        Download your archive first. Shared files used by another film are kept.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(`/projects/${id}`, {
              method: "DELETE",
              body: JSON.stringify({ confirm }),
            });
            onDeleted();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Type “{title}” to confirm
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoFocus
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <Button
          className="button"
          disabled={busy || confirm !== title}
          type="submit"
        >
          {busy ? "Deleting…" : "Delete permanently"}
        </Button>
        <Button className="button secondary" type="button" onClick={onClose}>
          Keep film
        </Button>
      </form>
    </Modal>
  );
}
