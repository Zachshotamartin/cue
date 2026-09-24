"use client";
import {
  FilmStrip,
  LinkSimple,
  Plus,
  UploadSimple,
} from "@phosphor-icons/react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useEditor } from "./EditorContext";
import { SceneCard } from "./SceneCard";
import { CaptureCard } from "./CaptureCard";
import { RecordingAnalysis } from "./RecordingAnalysis";

export function AssetLibrary() {
  const {
    draft,
    library,
    setLibrary,
    setCaptureOpen,
    input,
    addScene,
    upload,
    sceneAssets,
  } = useEditor();
  return (
    <>
      <div className="source-panel">
        <div className="panel-tabs">
          <Button
            className={library === "scenes" ? "active" : ""}
            onClick={() => setLibrary("scenes")}
          >
            Scenes <span>{draft.shots.length}</span>
          </Button>
          <Button
            className={library === "captures" ? "active" : ""}
            onClick={() => setLibrary("captures")}
          >
            Captures <span>{sceneAssets.length}</span>
          </Button>
        </div>
        <div className="source-scroll">
          {library === "scenes" ? (
            <>
              {draft.shots.map((s, i) => (
                <SceneCard key={s.id || i} s={s} i={i} />
              ))}
              {!draft.shots.length && (
                <div className="panel-empty">
                  <FilmStrip size={33} weight="thin" />
                  <h3>A story starts here.</h3>
                  <p>
                    Capture your website or import a few screens to build your
                    first cut.
                  </p>
                  <Button
                    className="button small"
                    onClick={() => setCaptureOpen(true)}
                  >
                    Add captures
                  </Button>
                </div>
              )}
              <Button
                className="add-scene"
                onClick={() => addScene(sceneAssets[0])}
              >
                <Plus size={16} />
                Add scene
              </Button>
            </>
          ) : (
            <>
              <Button
                className="button secondary small wide"
                onClick={() => setCaptureOpen(true)}
              >
                <Plus size={16} />
                Add captures
              </Button>
              {sceneAssets.length === 0 && (
                <p className="muted small-copy">
                  Your original screens and recordings will appear here.
                </p>
              )}
              {sceneAssets.map((a) => (
                <CaptureCard key={a.id || "item"} a={a} />
              ))}
              <RecordingAnalysis />
            </>
          )}
        </div>
        <div className="source-footer">
          <Button className="text-link" onClick={() => setCaptureOpen(true)}>
            <LinkSimple size={16} /> Capture a website
          </Button>
          <Button className="text-link" onClick={() => input.current?.click()}>
            <UploadSimple size={16} /> Import media
          </Button>
          <Input
            ref={input}
            hidden
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/avif,video/mp4,video/webm,audio/*"
            onChange={(e) => {
              if (e.target.files) upload(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>
    </>
  );
}
