"use client";

import { FilmStrip } from "@phosphor-icons/react";
import { Button } from "../ui/Button";

import { assetUrl } from "../client-api";
import { useEditor } from "./EditorContext";
import type { Shot } from "../../../../packages/contracts";
export function TimelineShot({ s, i }: { s: Shot; i: number }) {
  const { snap, choose, shot } = useEditor();

  const a = snap.assets.find((a) => a.id === s.assetId);
  return (
    <Button
      key={s.id}
      className={`timeline-shot ${shot?.id === s.id ? "selected" : ""}`}
      aria-label={`Select scene ${i + 1}: ${s.title}`}
      aria-pressed={shot?.id === s.id}
      onClick={() => choose(s)}
    >
      <div>
        {a?.kind === "image" ? (
          <img src={assetUrl(a.id)} alt="" />
        ) : (
          <FilmStrip size={22} />
        )}
        <span>{String(i + 1).padStart(2, "0")}</span>
      </div>
      <small>{s.duration}s</small>
    </Button>
  );
}
