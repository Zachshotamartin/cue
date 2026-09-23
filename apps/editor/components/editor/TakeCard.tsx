"use client";

import { Check } from "@phosphor-icons/react";
import { Button } from "../ui/Button";

import { assetUrl } from "../client-api";
import { useEditor } from "./EditorContext";
import type { Snapshot } from "../../../../packages/contracts";
export function TakeCard({ t }: { t: Snapshot["takes"][number] }) {
  const { shot, editShot } = useEditor();
  if (!shot) return null;
  return (
    <article className="take-card" key={t.id}>
      <video src={assetUrl(t.assetId)} controls preload="metadata" />
      <div>
        <span>{t.model}</span>
        <Button
          className="button secondary small"
          onClick={() =>
            editShot({
              selectedTakeId: t.id,
              mode: shot.mode === "exact-ui" ? "generated-video" : shot.mode,
            })
          }
        >
          {shot.selectedTakeId === t.id ? (
            <>
              <Check size={13} />
              Selected
            </>
          ) : (
            "Use this take"
          )}
        </Button>
      </div>
    </article>
  );
}
