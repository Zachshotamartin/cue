"use client";
import { CaretRight, Plus, Sparkle } from "@phosphor-icons/react";
import { Player } from "@remotion/player";
import { Film } from "../../../../packages/compositor/Film";
import {
  dimensions,
  durationFrames,
  type Draft,
} from "../../../../packages/contracts";
import { api, assetUrl } from "../client-api";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { useEditor } from "./EditorContext";
import { JobActivity } from "./JobActivity";
import { Timeline } from "./Timeline";

export function FilmWorkspace() {
  const {
    id,
    snap,
    draft,
    setLibrary,
    setTab,
    setNotice,
    busy,
    setCaptureOpen,
    player,
    history,
    mutate,
    action,
    savedRevision,
    sceneAssets,
    activeJobs,
    connected,
    selectedPlanner,
    total,
  } = useEditor();
  return (
    <>
      <main className="stage-panel">
        <div className="stage-toolbar">
          <div>
            <span className="stage-label">THE FIRST CUT</span>
            <span>
              {draft.format === "landscape"
                ? "16:9"
                : draft.format === "portrait"
                  ? "9:16"
                  : "1:1"}
            </span>
          </div>
          <div className="stage-controls">
            <Select
              aria-label="Film format"
              value={draft.format}
              onChange={(e) =>
                mutate((d) => {
                  d.format = e.target.value as Draft["format"];
                })
              }
            >
              <option value="landscape">Landscape</option>
              <option value="portrait">Portrait</option>
              <option value="square">Square</option>
            </Select>
            <Button className="text-link" onClick={() => setTab("brand")}>
              Film brief <CaretRight size={13} />
            </Button>
          </div>
        </div>
        <div className={`preview-stage ${draft.format}`}>
          {draft.shots.length ? (
            <Player
              ref={player}
              component={Film}
              inputProps={{
                draft,
                assets: snap.assets,
                takes: snap.takes,
                urls: Object.fromEntries(
                  snap.assets.map((a) => [a.id, assetUrl(a.id)]),
                ),
                fontUrl: "/brand/manrope.woff2",
              }}
              initialFrame={12}
              durationInFrames={durationFrames(draft)}
              fps={30}
              compositionWidth={dimensions(draft.format).width}
              compositionHeight={dimensions(draft.format).height}
              controls
              style={{
                width: "100%",
                maxHeight: "100%",
                aspectRatio: `${dimensions(draft.format).width}/${dimensions(draft.format).height}`,
              }}
              acknowledgeRemotionLicense
            />
          ) : (
            <div className="stage-empty">
              <img
                src="/brand/frames.png"
                alt="Glass frames ready for your product"
              />
              <div>
                <h2>
                  Your opening scene
                  <br />
                  is waiting.
                </h2>
                <p>Add real screens. Give them a direction.</p>
                <Button className="button" onClick={() => setCaptureOpen(true)}>
                  <Plus size={17} />
                  Add captures
                </Button>
              </div>
            </div>
          )}
        </div>
        <div className="timeline-head">
          <span>
            {draft.shots.length} scenes <span className="muted">/</span>{" "}
            {total.toFixed(1)} seconds
          </span>
          <div>
            <Button
              className="text-link"
              disabled={!sceneAssets.length || !!busy}
              onClick={() =>
                action("storyboard", async () => {
                  const revision = await savedRevision();
                  await api(`/projects/${id}/storyboard`, {
                    method: "POST",
                    body: JSON.stringify({ revision }),
                  });
                  history.current = [];
                  setLibrary("scenes");
                  setNotice(
                    "Starter storyboard created. Every scene is editable.",
                  );
                })
              }
            >
              Build a starter cut
            </Button>
            <Button
              className="text-link"
              disabled={!sceneAssets.length || !!busy}
              onClick={() => {
                setTab("brand");
                setNotice(
                  connected(selectedPlanner)
                    ? "Set your brief, then ask the director for a proposal."
                    : "Choose OpenAI, Claude or Gemini in Brief, then connect its API key in Settings.",
                );
              }}
            >
              <Sparkle size={14} />
              AI director
            </Button>
          </div>
        </div>
        <Timeline />
        {activeJobs.length > 0 && <JobActivity />}
      </main>
    </>
  );
}
