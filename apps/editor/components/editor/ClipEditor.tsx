"use client";
import { VisualCropEditor } from "./VisualCropEditor";
import { Disclosure } from "../ui/Disclosure";
import { useRef } from "react";
import { useEditor } from "./EditorContext";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { assetUrl } from "../client-api";
import { splitShot } from "../../../../packages/director/editing";
export function ClipEditor() {
  const {
    shot,
    snap,
    editShot,
    mutate,
    setSelected,
    player,
    draft,
    setNotice,
  } = useEditor();
  const video = useRef<HTMLVideoElement>(null);
  if (!shot) return null;
  const source = snap.assets.find((a) => a.id === shot.assetId);
  const end = shot.trimStart + shot.duration * shot.playbackRate;
  const split = () => {
    const before = draft.shots
      .slice(
        0,
        draft.shots.findIndex((s) => s.id === shot.id),
      )
      .reduce((n, s) => n + s.duration, 0);
    const at =
      Math.round(
        ((player.current?.getCurrentFrame() || 0) / 30 - before) * 30,
      ) / 30;
    if (
      at < 1 ||
      shot.duration - at < 1 ||
      shot.narrationAssetId ||
      shot.selectedTakeId
    ) {
      setNotice(
        "Move the film playhead inside this scene, leaving at least one second on either side. Detach narration and generated takes before splitting.",
      );
      return;
    }
    if (draft.shots.length >= 30) return;
    mutate((d) => {
      const i = d.shots.findIndex((s) => s.id === shot.id);
      const original = d.shots[i];
      d.shots.splice(i, 1, ...splitShot(original, at, crypto.randomUUID()));
    });
  };
  return (
    <Disclosure title="Clip timing & framing">
      <section className="clip-editor">
        <div className="clip-actions">
          <Button
            className="text-link"
            onClick={() => {
              const id = crypto.randomUUID();
              mutate((d) => {
                const i = d.shots.findIndex((s) => s.id === shot.id);
                d.shots.splice(i + 1, 0, {
                  ...structuredClone(shot),
                  id,
                  selectedTakeId: null,
                });
              });
              setSelected(id);
            }}
            disabled={draft.shots.length >= 30}
          >
            Duplicate
          </Button>
          <Button
            className="text-link"
            onClick={split}
            disabled={
              shot.duration < 2 ||
              draft.shots.length >= 30 ||
              !!shot.narrationAssetId ||
              !!shot.selectedTakeId
            }
            title="Detach narration and generated takes before splitting a scene"
          >
            Split at playhead
          </Button>
          <label>
            <Input
              type="checkbox"
              checked={shot.locked}
              onChange={(e) => editShot({ locked: e.target.checked })}
            />
            Keep in new stories
          </label>
        </div>
        {source?.kind === "video" && (
          <>
            <video
              ref={video}
              className="source-preview"
              src={`${assetUrl(source.id)}#t=${shot.trimStart}`}
              controls
              preload="metadata"
              onTimeUpdate={() => {
                if (video.current && video.current.currentTime > end)
                  video.current.pause();
              }}
            />
            <label>
              Start · {shot.trimStart.toFixed(1)}s
              <Input
                type="range"
                min={0}
                max={Math.max(
                  0,
                  (source.duration || 0) - shot.duration * shot.playbackRate,
                )}
                step={1 / 30}
                value={shot.trimStart}
                onChange={(e) => {
                  editShot({ trimStart: +e.target.value });
                  if (video.current)
                    video.current.currentTime = +e.target.value;
                }}
              />
            </label>
            <label>
              End · {end.toFixed(1)}s
              <Input
                type="range"
                min={shot.trimStart + shot.playbackRate}
                max={Math.min(
                  source.duration || 1,
                  shot.trimStart + 20 * shot.playbackRate,
                )}
                step={1 / 30}
                value={end}
                onChange={(e) =>
                  editShot({
                    duration: Math.max(
                      1,
                      (+e.target.value - shot.trimStart) / shot.playbackRate,
                    ),
                  })
                }
              />
            </label>
            <label>
              Playback speed
              <Select
                value={shot.playbackRate}
                onChange={(e) => {
                  const rate = +e.target.value;
                  editShot({
                    playbackRate: rate,
                    duration: Math.max(
                      1,
                      Math.min(20, (end - shot.trimStart) / rate),
                    ),
                  });
                }}
              >
                {[0.5, 1, 1.5, 2, 3].map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}×
                  </option>
                ))}
              </Select>
            </label>
          </>
        )}
        <label>
          Screen treatment
          <Select
            value={shot.presentation}
            onChange={(e) =>
              editShot({ presentation: e.target.value as "framed" | "full" })
            }
          >
            <option value="framed">Framed with context</option>
            <option value="full">Fill the frame</option>
          </Select>
        </label>
        <div className="clip-actions">
          <Button
            className="text-link"
            onClick={() => editShot({ focalEnd: { ...shot.focalRect } })}
          >
            Use current crop as ending frame
          </Button>
          <Button
            className="text-link"
            onClick={() => editShot({ focalEnd: null })}
          >
            Clear ending frame
          </Button>
        </div>
        <p className="field-help">
          Set an ending frame, then adjust the starting crop below to animate
          between them.
        </p>
        {source?.kind === "video" && (
          <label>
            Recorded audio volume
            <Input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={shot.sourceAudioVolume}
              onChange={(e) => editShot({ sourceAudioVolume: +e.target.value })}
            />
          </label>
        )}
        <VisualCropEditor />
      </section>
    </Disclosure>
  );
}
