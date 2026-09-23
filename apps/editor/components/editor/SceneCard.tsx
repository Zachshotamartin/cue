"use client";

import { ArrowUp, ArrowDown, FilmStrip } from "@phosphor-icons/react";
import { Button } from "../ui/Button";

import { assetUrl } from "../client-api";
import { useEditor } from "./EditorContext";
import type { Shot } from "../../../../packages/contracts";
export function SceneCard({ s, i }: { s: Shot; i: number }) {
  const { snap, draft, dragId, choose, shot, move } = useEditor();

  const a = snap.assets.find((a) => a.id === s.assetId);
  return (
    <div
      className={`scene-card ${shot?.id === s.id ? "selected" : ""}`}
      key={s.id}
      draggable
      onDragStart={() => {
        dragId.current = s.id;
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        move(dragId.current, i);
      }}
    >
      <Button className="scene-pick" onClick={() => choose(s)}>
        <div className="scene-thumbnail">
          {a?.kind === "image" ? (
            <img src={assetUrl(a.id)} alt="" />
          ) : a?.kind === "video" ? (
            <video src={assetUrl(a.id)} muted preload="metadata" />
          ) : (
            <FilmStrip size={30} weight="thin" />
          )}
          <span>{String(i + 1).padStart(2, "0")}</span>
        </div>
        <div className="scene-meta">
          <strong>{s.title}</strong>
          <small>
            {s.duration}s{" "}
            <span>
              {s.mode === "exact-ui"
                ? "Exact UI"
                : s.mode === "hybrid"
                  ? "Hybrid"
                  : "Generated"}
            </span>
          </small>
        </div>
      </Button>
      <div className="scene-move">
        <Button
          aria-label={`Move ${s.title} earlier`}
          disabled={i === 0}
          onClick={() => move(s.id, i - 1)}
        >
          <ArrowUp size={12} />
        </Button>
        <Button
          aria-label={`Move ${s.title} later`}
          disabled={i === draft.shots.length - 1}
          onClick={() => move(s.id, i + 1)}
        >
          <ArrowDown size={12} />
        </Button>
      </div>
    </div>
  );
}
