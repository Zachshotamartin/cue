"use client";
import { useState } from "react";
import { useEditor } from "./EditorContext";
import { api } from "../client-api";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { Disclosure } from "../ui/Disclosure";
export function AudioRights() {
  const { audioAssets, snap, action, busy } = useEditor();
  const [id, setId] = useState(""),
    [credit, setCredit] = useState(""),
    [license, setLicense] = useState(""),
    [sourceUrl, setSourceUrl] = useState("");
  const job = snap.jobs.find((j) => j.outputAssetId === id);
  return (
    <Disclosure title="Audio source & usage notes">
      <p className="field-help">
        Keep attribution and license information with the audio and project
        archive. These notes record your permissions; Cue cannot grant rights to
        uploaded or generated audio.
      </p>
      <label>
        Audio source
        <Select
          value={id}
          onChange={(e) => {
            const a = audioAssets.find((a) => a.id === e.target.value);
            const r = a?.metadata.rights as
              | { credit?: string; license?: string; sourceUrl?: string }
              | undefined;
            setId(e.target.value);
            setCredit(r?.credit || "");
            setLicense(r?.license || "");
            setSourceUrl(r?.sourceUrl || "");
          }}
        >
          <option value="">Choose an audio file</option>
          {audioAssets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </label>
      {id && (
        <>
          {job && (
            <p className="field-help">
              Generated with ElevenLabs · {job.payload.model || job.kind} ·{" "}
              {new Date(job.createdAt).toLocaleDateString()}. Your provider plan
              determines permitted use.
            </p>
          )}
          <label>
            Creator / attribution
            <Input
              value={credit}
              maxLength={500}
              onChange={(e) => setCredit(e.target.value)}
            />
          </label>
          <label>
            License or permission
            <Input
              value={license}
              maxLength={500}
              onChange={(e) => setLicense(e.target.value)}
            />
          </label>
          <label>
            Source / license URL
            <Input
              type="url"
              value={sourceUrl}
              maxLength={2048}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </label>
          <Button
            className="text-link"
            disabled={!!busy}
            onClick={() =>
              action("rights", () =>
                api(`/assets/${id}/rights`, {
                  method: "PATCH",
                  body: JSON.stringify({ credit, license, sourceUrl }),
                }),
              )
            }
          >
            Save source notes
          </Button>
        </>
      )}
    </Disclosure>
  );
}
