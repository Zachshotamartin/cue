"use client";
import { AudioInspector } from "./AudioInspector";
import { BriefInspector } from "./BriefInspector";
import { useEditor } from "./EditorContext";
import { ExportInspector } from "./ExportInspector";
import { GenerateInspector } from "./GenerateInspector";
import { SceneInspector } from "./SceneInspector";
import { Tabs } from "../ui/Tabs";

export function Inspector() {
  const { tab, setTab } = useEditor();
  return (
    <>
      <div className="inspector">
        <Tabs
          id="inspector"
          label="Editing tools"
          className="inspector-tabs"
          tabs={[
            { value: "scene", label: "Scene" },
            { value: "generate", label: "Generate" },
            { value: "audio", label: "Audio" },
            { value: "brand", label: "Brief" },
            { value: "export", label: "Export" },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div
          className="inspector-content"
          id="inspector-panel"
          role="tabpanel"
          aria-labelledby={`inspector-${tab}`}
        >
          <SceneInspector />
          <GenerateInspector />
          <AudioInspector />
          <BriefInspector />
          <ExportInspector />
        </div>
      </div>
    </>
  );
}
