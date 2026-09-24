"use client";
import { Plus } from "@phosphor-icons/react";
import { useState } from "react";
import { EvidenceStrip } from "./EvidenceStrip";
import { RedactionDialog } from "./RedactionDialog";

import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

import type { Asset } from "../../../../packages/contracts";
import { assetUrl } from "../client-api";
import { useEditor } from "./EditorContext";
export function CaptureCard({ a }: { a: Asset }) {
  const [redacting, setRedacting] = useState(false);
  const { draft, setNotice, mutate, shot, editShot, addScene } = useEditor();
  const synthetic = a.metadata.state === "generated";
  return (
    <article className="capture-card" key={a.id}>
      {a.kind === "image" ? (
        <img src={assetUrl(a.id)} alt={a.name} />
      ) : (
        <video src={assetUrl(a.id)} controls preload="metadata" />
      )}
      <EvidenceStrip asset={a} />
      <strong>{a.metadata.state || a.name}</strong>
      <small>
        {a.width} × {a.height}
        {a.duration ? ` · ${a.duration.toFixed(1)}s` : ""}
      </small>
      <label className="include-capture">
        <Input
          type="checkbox"
          disabled={
            synthetic ||
            !!(a.metadata.privacyPending || a.metadata.supersededBy)
          }
          checked={
            !synthetic &&
            !a.metadata.privacyPending &&
            !a.metadata.supersededBy &&
            !draft.excludedAssetIds.includes(a.id)
          }
          onChange={(e) =>
            mutate((d) => {
              d.excludedAssetIds = e.target.checked
                ? d.excludedAssetIds.filter((id) => id !== a.id)
                : [...d.excludedAssetIds, a.id];
            })
          }
        />
        Include in AI direction
      </label>
      {synthetic && (
        <p className="field-help">
          Generated atmosphere is not evidence of product behavior.
        </p>
      )}
      {!!(a.metadata.privacyPending || a.metadata.supersededBy) && (
        <p className="field-help">
          Original excluded from AI planning. Use the safe copy after reviewing
          it.
        </p>
      )}
      <div className="capture-actions">
        <Button className="text-link" onClick={() => setRedacting(true)}>
          Privacy masks
        </Button>
        <Button className="text-link" onClick={() => addScene(a)}>
          Add scene <Plus size={13} />
        </Button>
        {shot && (
          <Button
            className="text-link"
            onClick={() => {
              editShot({ assetId: a.id, selectedTakeId: null });
              setNotice("Scene source updated.");
            }}
          >
            Use in scene
          </Button>
        )}
      </div>
      {redacting && (
        <RedactionDialog asset={a} onClose={() => setRedacting(false)} />
      )}
    </article>
  );
}
