"use client";
import { useRef, useState } from "react";
import type { Asset, Shot } from "../../../../packages/contracts";
import { RegionSelector } from "../ui/RegionSelector";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { assetUrl, api, jobOptions } from "../client-api";
import { useEditor } from "./EditorContext";
export function RedactionDialog({
  asset,
  onClose,
}: {
  asset: Asset;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [at, setAt] = useState(0);
  const { id, action, busy, setNotice } = useEditor();
  const [regions, setRegions] = useState<Shot["focalRect"][]>([]),
    [removeAudio, setRemoveAudio] = useState(true);
  return (
    <Modal labelledBy="redact-title" onClose={onClose}>
      <h2 id="redact-title">Make a safe copy</h2>
      <p>
        Drag over private information. Masks cover those fixed screen areas
        throughout the clip. If content moves, mask its full path or trim and
        record that portion again. The original stays private in your library
        and is excluded from future AI planning.
      </p>
      <RegionSelector
        ratio={`${asset.width}/${asset.height}`}
        onRegion={(r) => setRegions((old) => [...old, r].slice(0, 20))}
      >
        {asset.kind === "image" ? (
          <img
            src={assetUrl(asset.id)}
            alt="Select private areas"
            draggable={false}
            style={{ width: "100%", display: "block", pointerEvents: "none" }}
          />
        ) : (
          <video
            ref={video}
            src={assetUrl(asset.id)}
            muted
            preload="metadata"
            style={{ width: "100%", display: "block", pointerEvents: "none" }}
          />
        )}
        {regions.map((r, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${r.x * 100}%`,
              top: `${r.y * 100}%`,
              width: `${r.width * 100}%`,
              height: `${r.height * 100}%`,
              background: "black",
              border: "1px solid white",
              pointerEvents: "none",
            }}
          />
        ))}
      </RegionSelector>
      {asset.kind === "video" && (
        <label>
          Review frame · {at.toFixed(1)}s
          <Input
            type="range"
            min={0}
            max={Math.max(0, (asset.duration || 0) - 0.05)}
            step={0.05}
            value={at}
            onChange={(e) => {
              setAt(+e.target.value);
              if (video.current) video.current.currentTime = +e.target.value;
            }}
          />
        </label>
      )}
      <Button
        className="text-link"
        onClick={() =>
          setRegions(
            [...regions, { x: 0, y: 0, width: 0.25, height: 0.25 }].slice(
              0,
              20,
            ),
          )
        }
      >
        Add a mask with numeric controls
      </Button>
      {regions.map((r, i) => (
        <div className="field-pair" key={i}>
          {(["x", "y", "width", "height"] as const).map((key) => (
            <label key={key}>
              {key} (%)
              <Input
                type="number"
                min={key === "width" || key === "height" ? 1 : 0}
                max={100}
                value={Math.round(r[key] * 100)}
                onChange={(e) =>
                  setRegions((old) =>
                    old.map((item, n) =>
                      n === i
                        ? {
                            ...item,
                            [key]: Math.max(
                              key === "width" || key === "height" ? 0.01 : 0,
                              Math.min(
                                key === "x"
                                  ? 1 - item.width
                                  : key === "y"
                                    ? 1 - item.height
                                    : key === "width"
                                      ? 1 - item.x
                                      : 1 - item.y,
                                +e.target.value / 100,
                              ),
                            ),
                          }
                        : item,
                    ),
                  )
                }
              />
            </label>
          ))}
        </div>
      ))}
      <Button className="text-link" onClick={() => setRegions([])}>
        Clear masks
      </Button>
      {asset.kind === "video" && (
        <label>
          <Input
            type="checkbox"
            checked={removeAudio}
            onChange={(e) => setRemoveAudio(e.target.checked)}
          />
          Remove original audio
        </label>
      )}
      <Button
        className="button"
        disabled={!!busy || !regions.length}
        onClick={() =>
          action("redact", async () => {
            await api(
              `/projects/${id}/redact`,
              jobOptions({ assetId: asset.id, regions, removeAudio }),
            );
            setNotice(
              "Creating a masked copy. Review it in Captures before using it in your film.",
            );
            onClose();
          })
        }
      >
        Create safe copy
      </Button>
    </Modal>
  );
}
