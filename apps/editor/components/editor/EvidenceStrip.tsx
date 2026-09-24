"use client";
import type { Asset } from "../../../../packages/contracts";
import type { EvidenceAnalysis } from "../../../../packages/contracts/evidence";
import { Button } from "../ui/Button";
import { useEditor } from "./EditorContext";
export function EvidenceStrip({ asset }: { asset: Asset }) {
  const { shot, editShot, setNotice } = useEditor(),
    analysis = asset.metadata.analysis as EvidenceAnalysis | undefined;
  if (!analysis?.frames?.length) return null;
  return (
    <div className="evidence-strip" aria-label="Analyzed moments">
      {analysis.frames.map((f, i) => (
        <Button
          key={i}
          className="evidence-moment"
          title={`Start selected scene at ${f.at.toFixed(1)} seconds`}
          disabled={!shot || shot.assetId !== asset.id}
          onClick={() => {
            editShot({
              trimStart: Math.min(
                f.at,
                Math.max(
                  0,
                  (asset.duration || 0) - shot!.duration * shot!.playbackRate,
                ),
              ),
            });
            setNotice(
              "Source start updated. Preview the action and its result.",
            );
          }}
        >
          <img
            src={`/api/assets/${asset.id}/frame/${i}`}
            alt={`Recording at ${f.at.toFixed(1)} seconds`}
          />
          <small>{f.at.toFixed(1)}s</small>
        </Button>
      ))}
    </div>
  );
}
