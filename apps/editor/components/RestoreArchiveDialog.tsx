"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./ui/Modal";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { api } from "./client-api";
import { uploadMedia } from "./upload-media";
import { draftSchema } from "../../../packages/contracts";
export function RestoreArchiveDialog({ onClose }: { onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null),
    target = useRef<string | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  useEffect(() => {
    input.current?.setAttribute("webkitdirectory", "");
  }, []);
  async function restore(files: FileList) {
    setBusy(true);
    try {
      const list = [...files],
        manifest = list.find((f) => f.name === "project.json");
      if (!manifest || manifest.size > 2 * 1048576)
        throw Error(
          "Choose the extracted archive folder containing project.json and assets.",
        );
      const manifestText = await manifest.text();
      const archive = JSON.parse(manifestText);
      const { accountId } = await api<{ accountId: string }>("/settings");
      const digest = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(manifestText),
          ),
        ),
      )
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
      const recoveryKey = `cue:restore:${accountId}:${digest}`;
      const draft = draftSchema.parse(archive.project?.draft);
      if (
        archive.version !== 1 ||
        !Array.isArray(archive.assets) ||
        archive.assets.length > 1000
      )
        throw Error("Unsupported archive.");
      target.current = null;
      try {
        const previous = localStorage.getItem(recoveryKey);
        if (previous) {
          const snapshot = await api(`/projects/${previous}`);
          if (
            snapshot.project.revision === 1 &&
            !snapshot.project.draft.shots.length
          )
            target.current = previous;
        }
      } catch {
        /* A removed or inaccessible restore gets a fresh private film. */
      }
      if (!target.current) {
        const created = await api("/projects", {
          method: "POST",
          body: JSON.stringify({
            title: `${draft.title} · restored`.slice(0, 100),
            siteUrl: draft.siteUrl,
          }),
        });
        target.current = created.project.id;
        try {
          localStorage.setItem(recoveryKey, created.project.id);
        } catch {
          /* Server uploads still resume within this dialog. */
        }
      }
      const mapping: Record<string, string> = {};
      for (const [i, asset] of archive.assets.entries()) {
        const name = String(asset.path).split("/").pop();
        const file = list.find((f) =>
          f.webkitRelativePath.endsWith(`/assets/${name}`),
        );
        if (!file)
          throw Error(
            `Missing media file ${name}. The unfinished restore is saved; choose the same folder to retry.`,
          );
        setMessage(`Restoring media ${i + 1} of ${archive.assets.length}…`);
        const uploaded = await uploadMedia(
          target.current!,
          file,
          asset.metadata || {},
        );
        if (
          uploaded.hash !== asset.hash &&
          uploaded.metadata.originalHash !== asset.hash
        )
          throw Error(`The archive file ${name} has changed.`);
        mapping[asset.id] = uploaded.id;
      }
      const current = await api(`/projects/${target.current}`);
      await api(`/projects/${target.current}/restore-archive`, {
        method: "POST",
        body: JSON.stringify({
          revision: current.project.revision,
          draft,
          mapping,
          sources: archive.assets.map(
            (a: {
              id: string;
              hash: string;
              metadata?: { privacyPending?: boolean; supersededBy?: string };
            }) => ({
              id: a.id,
              hash: a.hash,
              privacyPending: a.metadata?.privacyPending,
              supersededBy: a.metadata?.supersededBy,
            }),
          ),
          takes: archive.takes || [],
        }),
      });
      try {
        localStorage.removeItem(recoveryKey);
      } catch {}
      router.push(`/projects/${target.current}`);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal labelledBy="restore-title" onClose={onClose}>
      <h2 id="restore-title">Restore a film archive</h2>
      <p>
        Unzip the Cue archive on your computer, then choose that folder.
        Original media is verified before restoring the editable film. API keys
        and account details are never imported.
      </p>
      <Input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void restore(e.target.files);
          e.target.value = "";
        }}
      />
      <Button
        className="button"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? "Restoring…" : "Choose extracted folder"}
      </Button>
      {message && <p role="status">{message}</p>}
    </Modal>
  );
}
