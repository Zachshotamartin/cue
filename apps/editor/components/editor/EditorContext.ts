"use client";
import { createContext, useContext } from "react";
import type { useEditorController } from "./useEditorController";
export const EditorContext = createContext<ReturnType<
  typeof useEditorController
> | null>(null);
export function useEditor() {
  const state = useContext(EditorContext);
  if (!state?.draft || !state.snap)
    throw new Error("Editor components require a loaded project");
  return { ...state, draft: state.draft, snap: state.snap };
}
