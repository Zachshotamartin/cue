"use client";
import { useState } from "react";
import { RegionSelector } from "../ui/RegionSelector";
import { useEditor } from "./EditorContext";
import { Button } from "../ui/Button";
import { assetUrl } from "../client-api";
export function VisualCropEditor() {
  const { shot, snap, editShot, player, draft } = useEditor();
  const [mode, setMode] = useState<"crop" | "highlight">("crop");
  if (!shot) return null;
  const source = snap.assets.find((a) => a.id === shot.assetId);
  if (!source || !source.width || !source.height) return null;
  const crop = shot.focalRect;
  return (
    <section className="visual-crop">
      <div className="clip-actions">
        <Button
          className="text-link"
          aria-pressed={mode === "crop"}
          onClick={() => setMode("crop")}
        >
          Crop
        </Button>
        <Button
          className="text-link"
          aria-pressed={mode === "highlight"}
          onClick={() => setMode("highlight")}
        >
          Click emphasis
        </Button>
        <Button
          className="text-link"
          onClick={() =>
            editShot({
              focalRect: { x: 0, y: 0, width: 1, height: 1 },
              focalEnd: null,
            })
          }
        >
          Reset crop
        </Button>
      </div>
      <p className="field-help">
        {mode === "crop"
          ? "Drag a rectangle around the UI to show. Numeric crop controls remain available below."
          : "Click the UI to emphasize it at the current film playhead."}
      </p>
      <RegionSelector
        ratio={`${source.width}/${source.height}`}
        minSize={0.1}
        onRegion={
          mode === "crop" ? (focalRect) => editShot({ focalRect }) : undefined
        }
        onPoint={
          mode === "highlight"
            ? (b) => {
                const offset = draft.shots
                  .slice(
                    0,
                    draft.shots.findIndex((s) => s.id === shot.id),
                  )
                  .reduce((t, s) => t + s.duration, 0);
                const at = Math.max(
                  0,
                  Math.min(
                    shot.duration - 0.2,
                    (player.current?.getCurrentFrame() || 0) / 30 - offset,
                  ),
                );
                editShot({
                  emphasis: [
                    ...shot.emphasis,
                    { ...b, at, duration: 0.7, label: "" },
                  ].slice(-20),
                });
              }
            : undefined
        }
      >
        {source.kind === "image" ? (
          <img
            src={assetUrl(source.id)}
            alt="Source for crop selection"
            draggable={false}
          />
        ) : (
          <video
            src={`${assetUrl(source.id)}#t=${shot.trimStart}`}
            preload="metadata"
            muted
            playsInline
          />
        )}
        <div
          className="crop-outline"
          style={{
            left: `${crop.x * 100}%`,
            top: `${crop.y * 100}%`,
            width: `${crop.width * 100}%`,
            height: `${crop.height * 100}%`,
          }}
        />
      </RegionSelector>
      {shot.emphasis.length > 0 && (
        <Button
          className="text-link"
          onClick={() => editShot({ emphasis: [] })}
        >
          Clear {shot.emphasis.length} emphasis markers
        </Button>
      )}
    </section>
  );
}
