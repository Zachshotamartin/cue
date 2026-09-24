"use client";
import { useState } from "react";
import { api } from "./client-api";
import { Button } from "./ui/Button";
type Health = {
  dataEnvironment: string;
  storage: string;
  storageBytes: number;
  release: string;
  queue: { active: number; oldestSeconds: number; needsReconciliation: number };
};
export function AccountHealth() {
  const [health, setHealth] = useState<Health | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="privacy-note">
      <h3>Account diagnostics</h3>
      <p>
        Check your storage and job queue without exposing keys or private media.
      </p>
      <Button
        className="text-link"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            setHealth(await api<Health>("/health"));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Checking…" : "Check account health"}
      </Button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {health && (
        <div role="status">
          <p>
            {(health.storageBytes / 1024 / 1024).toFixed(1)} MiB stored ·{" "}
            {health.queue.active} active jobs · {health.dataEnvironment}
          </p>
          {health.queue.oldestSeconds > 300 && (
            <p className="notice">
              Your oldest job has been waiting or running for{" "}
              {Math.ceil(health.queue.oldestSeconds / 60)} minutes. Check its
              film’s job history before starting another request.
            </p>
          )}
          {health.queue.needsReconciliation > 0 && (
            <p className="notice">
              {health.queue.needsReconciliation} requests have uncertain
              provider outcomes. Reconcile them in the film’s Export history to
              release or confirm their budget reservations.
            </p>
          )}
          <p className="field-help">
            Release {health.release} · {health.storage}
          </p>
        </div>
      )}
    </section>
  );
}
