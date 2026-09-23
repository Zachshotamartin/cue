"use client";
import { ResizableSidebar } from "../ui/ResizableSidebar";
import { AssetLibrary } from "./AssetLibrary";
import { useEditor } from "./EditorContext";
import { FilmWorkspace } from "./FilmWorkspace";
import { Inspector } from "./Inspector";

export function EditorWorkspace() {
  const { workspace } = useEditor();
  return (
    <div
      ref={workspace.attach}
      className={`editor-body ${workspace.stacked ? "is-stacked" : ""}`}
    >
      <ResizableSidebar
        side="left"
        label="Library"
        width={workspace.displayedWidth("left")}
        maxWidth={workspace.maximum("left")}
        collapsed={workspace.panels.left.collapsed}
        stacked={workspace.stacked}
        onResize={(w) => workspace.resize("left", w)}
        onCollapse={(c) => workspace.collapse("left", c)}
      >
        <AssetLibrary />
      </ResizableSidebar>
      <FilmWorkspace />
      <ResizableSidebar
        side="right"
        label="Inspector"
        width={workspace.displayedWidth("right")}
        maxWidth={workspace.maximum("right")}
        collapsed={workspace.panels.right.collapsed}
        stacked={workspace.stacked}
        onResize={(w) => workspace.resize("right", w)}
        onCollapse={(c) => workspace.collapse("right", c)}
      >
        <Inspector />
      </ResizableSidebar>
    </div>
  );
}
