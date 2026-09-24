"use client";

import type { Shot } from "../../../../packages/contracts";
import { assetUrl } from "../client-api";
import { useEditor } from "./EditorContext";
export function ProposalScene({ s, i }: { s: Shot; i: number }) {
  const { snap } = useEditor();
  const source = snap.assets.find((a) => a.id === s.assetId);
  return (
    <article className="proposal-scene" key={i}>
      <div className="proposal-media">
        {source?.kind === "video" ? (
          <video
            controls
            preload="metadata"
            src={`${assetUrl(source.id)}#t=${s.trimStart},${s.trimStart + s.duration}`}
          />
        ) : (
          source && <img alt={source.name} src={assetUrl(source.id)} />
        )}
        <span>{i + 1}</span>
      </div>
      <div>
        <strong>{s.title}</strong>
        <p>{s.caption}</p>
        <small>
          {s.duration}s / {s.mode}
        </small>
        <p>{s.purpose}</p>
        {s.action && (
          <p>
            <strong>Action:</strong> {s.action}
          </p>
        )}
        {s.outcome && (
          <p>
            <strong>Result:</strong> {s.outcome}
          </p>
        )}
        {source?.kind === "video" && (
          <small>
            Source: {s.trimStart.toFixed(1)}–
            {(s.trimStart + s.duration).toFixed(1)}s
          </small>
        )}
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
