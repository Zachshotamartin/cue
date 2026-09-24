"use client";
import { Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { ReviseSceneDialog } from "./ReviseSceneDialog";
import { type Shot } from "../../../../packages/contracts";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { useEditor } from "./EditorContext";
import { EmphasisEditor } from "./EmphasisEditor";
import { ClipEditor } from "./ClipEditor";
import { Disclosure } from "../ui/Disclosure";

export function SceneInspector() {
  const [revising, setRevising] = useState(false);
  const { tab, mutate, shot, editShot, sceneAssets } = useEditor();
  return (
    <>
      {tab === "scene" &&
        (shot ? (
          <>
            <div className="inspector-heading">
              <h2>{shot.title}</h2>
              <Button
                className="icon-button"
                aria-label="Delete selected scene"
                onClick={() =>
                  mutate((d) => {
                    d.shots = d.shots.filter((s) => s.id !== shot.id);
                  })
                }
              >
                <Trash size={16} />
              </Button>
            </div>
            <ClipEditor />
            <EmphasisEditor />
            <Button className="text-link" onClick={() => setRevising(true)}>
              Ask AI to revise this scene
            </Button>
            {revising && (
              <ReviseSceneDialog onClose={() => setRevising(false)} />
            )}
            <label>
              Scene name
              <Input
                value={shot.title}
                onChange={(e) => editShot({ title: e.target.value })}
              />
            </label>
            <label>
              On-screen caption
              <Textarea
                rows={2}
                maxLength={140}
                value={shot.caption}
                onChange={(e) => editShot({ caption: e.target.value })}
              />
            </label>
            <label>
              Source
              <Select
                value={shot.assetId || ""}
                onChange={(e) =>
                  editShot({
                    assetId: e.target.value || null,
                    selectedTakeId: null,
                  })
                }
              >
                <option value="">No source</option>
                {sceneAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.metadata.state || a.name}
                  </option>
                ))}
              </Select>
            </label>
            <div className="field-pair">
              <label>
                Duration (seconds)
                <Input
                  type="number"
                  min={1}
                  max={20}
                  step={0.5}
                  value={shot.duration}
                  onChange={(e) =>
                    editShot({
                      duration: Math.min(
                        20,
                        Math.max(1, Number(e.target.value) || 1),
                      ),
                    })
                  }
                />
              </label>
              <label>
                Layout
                <Select
                  value={shot.template}
                  onChange={(e) =>
                    editShot({
                      template: e.target.value as Shot["template"],
                    })
                  }
                >
                  {[
                    "reveal",
                    "showcase",
                    "closeup",
                    "comparison",
                    "atmosphere",
                    "endcard",
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </label>
            </div>
            {shot.template === "comparison" && (
              <label>
                Comparison source
                <Select
                  value={shot.secondaryAssetId || ""}
                  onChange={(e) =>
                    editShot({ secondaryAssetId: e.target.value || null })
                  }
                >
                  <option value="">Choose another screen</option>
                  {sceneAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            <div className="field-pair">
              <label>
                Movement
                <Select
                  value={shot.motion}
                  onChange={(e) =>
                    editShot({ motion: e.target.value as Shot["motion"] })
                  }
                >
                  {["push", "pull", "pan", "float", "still"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </label>
              <label>
                Transition
                <Select
                  value={shot.transition}
                  onChange={(e) =>
                    editShot({
                      transition: e.target.value as Shot["transition"],
                    })
                  }
                >
                  <option value="fade">Fade</option>
                  <option value="cut">Cut</option>
                </Select>
              </label>
            </div>
            <label>
              Rendering mode
              <Select
                value={shot.mode}
                onChange={(e) =>
                  editShot({ mode: e.target.value as Shot["mode"] })
                }
              >
                <option value="exact-ui">Exact UI</option>
                <option value="generated-video">Generated video</option>
                <option value="hybrid">
                  Hybrid: UI + generated background
                </option>
              </Select>
            </label>
            <p className="field-help">
              Exact UI keeps your source intact. Generated and hybrid scenes
              need a selected take before export.
            </p>
            <Disclosure title="Precise crop & color">
              <label>
                Crop width{" "}
                <span>{Math.round(shot.focalRect.width * 100)}%</span>
                <Input
                  type="range"
                  min={0.2}
                  max={1}
                  step={0.01}
                  value={shot.focalRect.width}
                  onChange={(e) => {
                    const width = +e.target.value;
                    editShot({
                      focalRect: {
                        ...shot.focalRect,
                        width,
                        x: Math.min(shot.focalRect.x, 1 - width),
                      },
                    });
                  }}
                />
              </label>
              <label>
                Crop height{" "}
                <span>{Math.round(shot.focalRect.height * 100)}%</span>
                <Input
                  type="range"
                  min={0.2}
                  max={1}
                  step={0.01}
                  value={shot.focalRect.height}
                  onChange={(e) => {
                    const height = +e.target.value;
                    editShot({
                      focalRect: {
                        ...shot.focalRect,
                        height,
                        y: Math.min(shot.focalRect.y, 1 - height),
                      },
                    });
                  }}
                />
              </label>
              <label>
                Horizontal position
                <Input
                  type="range"
                  min={0}
                  max={1 - shot.focalRect.width}
                  step={0.01}
                  value={shot.focalRect.x}
                  onChange={(e) =>
                    editShot({
                      focalRect: {
                        ...shot.focalRect,
                        x: +e.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                Vertical position
                <Input
                  type="range"
                  min={0}
                  max={1 - shot.focalRect.height}
                  step={0.01}
                  value={shot.focalRect.y}
                  onChange={(e) =>
                    editShot({
                      focalRect: {
                        ...shot.focalRect,
                        y: +e.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                Video start (seconds)
                <Input
                  type="number"
                  min={0}
                  max={600}
                  step={0.1}
                  value={shot.trimStart}
                  onChange={(e) =>
                    editShot({ trimStart: Math.max(0, +e.target.value) })
                  }
                />
              </label>
              <label>
                Scene background
                <Input
                  type="color"
                  value={shot.background}
                  onChange={(e) => editShot({ background: e.target.value })}
                />
              </label>
            </Disclosure>
          </>
        ) : (
          <div className="panel-empty">
            <p>Select or add a scene to start directing.</p>
          </div>
        ))}
    </>
  );
}
