"use client";

import { useEditor } from "./EditorContext";
import type { Shot } from "../../../../packages/contracts";
export function ProposalScene({ s, i }: { s: Shot; i: number }) {
  const { id, snap } = useEditor();
  return (
    <article className="proposal-scene" key={i}>
      <span>{i + 1}</span>
      <div>
        <strong>{s.title}</strong>
        <p>{s.caption}</p>
        <small>
          {s.duration}s / {s.mode}
        </small>
        <p>{s.purpose}</p>
        <small>
          Evidence:{" "}
          {s.evidenceIds
            .map((id) => snap.assets.find((a) => a.id === id)?.name || id)
            .join(", ")}
        </small>
      </div>
    </article>
  );
}
