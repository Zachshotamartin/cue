"use client";
import { useState } from "react";
import { Modal } from "./ui/Modal";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { api } from "./client-api";
export function DeleteAccountDialog({
  email,
  onClose,
}: {
  email: string;
  onClose: () => void;
}) {
  const [confirm, setConfirm] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal labelledBy="delete-account-title" onClose={onClose}>
      <h2 id="delete-account-title">Delete your Cue account</h2>
      <p>
        This removes your films, revisions, provider keys and paired capture
        devices. Media deletion runs in the cleanup queue. Download any film
        archives you want to keep first. Active or uncertain jobs must be
        resolved before deletion.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("/account", {
              method: "DELETE",
              body: JSON.stringify({ email: confirm, password }),
            });
            for (const key of Object.keys(localStorage))
              if (key.startsWith("cue:")) localStorage.removeItem(key);
            location.assign("/");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Type your email to confirm
          <Input
            type="email"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <label>
          Confirm your password
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <Button
          className="button"
          type="submit"
          disabled={busy || confirm !== email || !password}
        >
          {busy ? "Deleting…" : "Delete account permanently"}
        </Button>
      </form>
    </Modal>
  );
}
