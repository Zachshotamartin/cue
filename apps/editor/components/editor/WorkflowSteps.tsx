"use client";
import { Button } from "../ui/Button";
import { useEditor } from "./EditorContext";
export function WorkflowSteps() {
  const {
    draft,
    sceneAssets,
    setTab,
    setLibrary,
    setCaptureOpen,
    tab,
    exports,
  } = useEditor();
  const steps = [
    {
      label: "Brief",
      complete: !!draft.description,
      active: tab === "brand",
      select: () => setTab("brand"),
    },
    {
      label: "Capture",
      complete: sceneAssets.length > 0,
      active: false,
      select: () => {
        setLibrary("captures");
        setCaptureOpen(true);
      },
    },
    {
      label: "Story",
      complete: draft.shots.length > 0,
      active: false,
      select: () => {
        setLibrary("scenes");
        setTab("brand");
      },
    },
    {
      label: "Edit & sound",
      complete:
        draft.shots.some((s) => !!s.narrationAssetId) || !!draft.musicAssetId,
      active: tab === "scene" || tab === "audio",
      select: () => setTab("scene"),
    },
    {
      label: "Export",
      complete: exports.length > 0,
      active: tab === "export",
      select: () => setTab("export"),
    },
  ];
  return (
    <nav className="workflow-steps" aria-label="Film workflow">
      {steps.map((s, i) => (
        <Button
          key={s.label}
          className={`workflow-step ${s.active ? "active" : ""}`}
          onClick={s.select}
          aria-current={s.active ? "step" : undefined}
        >
          <span>{s.complete ? "✓" : String(i + 1).padStart(2, "0")}</span>
          {s.label}
        </Button>
      ))}
    </nav>
  );
}
