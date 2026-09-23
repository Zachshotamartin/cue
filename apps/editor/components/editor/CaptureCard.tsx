"use client";
import { Plus } from "@phosphor-icons/react";

import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

import { assetUrl } from "../client-api";
import { useEditor } from "./EditorContext";
import type { Asset } from "../../../../packages/contracts";
export function CaptureCard({ a }: { a: Asset }) {
  const { id, draft, setNotice, mutate, shot, editShot, addScene } =
    useEditor();
  return (
    <article className="capture-card" key={a.id}>
      {a.kind === "image" ? (
        <img src={assetUrl(a.id)} alt={a.name} />
      ) : (
        <video src={assetUrl(a.id)} controls preload="metadata" />
      )}
      <strong>{a.metadata.state || a.name}</strong>
      <small>
        {a.width} × {a.height}
        {a.duration ? ` · ${a.duration.toFixed(1)}s` : ""}
      </small>
      <label className="include-capture">
        <Input
          type="checkbox"
          checked={!draft.excludedAssetIds.includes(a.id)}
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
      <div className="capture-actions">
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
    </article>
  );
}
