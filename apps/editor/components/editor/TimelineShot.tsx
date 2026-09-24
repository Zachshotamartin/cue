"use client";
import { FilmStrip } from "@phosphor-icons/react";
import { Button } from "../ui/Button";
import { TimelineHandle } from "../ui/TimelineHandle";
import { assetUrl } from "../client-api";
import { useEditor } from "./EditorContext";
import type { Shot } from "../../../../packages/contracts";
import type { EvidenceAnalysis } from "../../../../packages/contracts/evidence";
import { patchShot } from "../../../../packages/director/editing";
export function TimelineShot({ s, i }: { s: Shot; i: number }) {
  const { snap, choose, shot, mutate } = useEditor(),
    take = snap.takes.find((t) => t.id === s.selectedTakeId),
    a = snap.assets.find(
      (a) =>
        a.id === (s.mode === "generated-video" ? take?.assetId : s.assetId),
    );
  const frames =
    (a?.metadata.analysis as EvidenceAnalysis | undefined)?.frames || [];
  const max =
    s.template !== "endcard" && a?.kind === "video"
      ? Math.max(
          1,
          Math.min(20, ((a.duration || 0) - s.trimStart) / s.playbackRate),
        )
      : 20;
  return (
    <div className="timeline-shot-item">
      <Button
        className={`timeline-shot ${shot?.id === s.id ? "selected" : ""}`}
        aria-label={`Select scene ${i + 1}: ${s.title}`}
        aria-pressed={shot?.id === s.id}
        onClick={() => choose(s)}
      >
        <div>
          {a?.kind === "image" ? (
            <img src={assetUrl(a.id)} alt="" />
          ) : frames.length ? (
            <div className="timeline-frames">
              {[0, 0.5, 1].map((part, n) => {
                const at = s.trimStart + s.duration * s.playbackRate * part,
                  index = frames.reduce(
                    (best, f, i) =>
                      Math.abs(f.at - at) < Math.abs(frames[best].at - at)
                        ? i
                        : best,
                    0,
                  );
                return (
                  <img
                    key={n}
                    src={`/api/assets/${a!.id}/frame/${index}`}
                    alt=""
                  />
                );
              })}
            </div>
          ) : (
            <FilmStrip size={22} />
          )}
          <span>
            {String(i + 1).padStart(2, "0")}
            {s.locked ? " · Locked" : ""}
          </span>
        </div>
        <small>
          {s.duration.toFixed(1)}s · {s.title}
        </small>
      </Button>
      <TimelineHandle
        label={`Scene ${i + 1} duration`}
        value={s.duration}
        max={max}
        onChange={(duration) =>
          mutate((d) => {
            const index = d.shots.findIndex((x) => x.id === s.id);
            d.shots[index] = patchShot(d.shots[index], { duration });
          })
        }
      />
    </div>
  );
}
