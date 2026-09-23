"use client";
import { CaptureDialog } from "./editor/CaptureDialog";
import { EditorContext } from "./editor/EditorContext";
import { EditorHeader } from "./editor/EditorHeader";
import { EditorLoading } from "./editor/EditorLoading";
import { EditorWorkspace } from "./editor/EditorWorkspace";
import { ProposalDialog } from "./editor/ProposalDialog";
import { RecoveryBanner } from "./editor/RecoveryBanner";
import { useEditorController } from "./editor/useEditorController";
import { Notice } from "./ui/Notice";

export function Editor({ id }: { id: string }) {
  const state = useEditorController(id);
  const {
    error,
    setError,
    notice,
    setNotice,
    captureOpen,
    showProposal,
    conflict,
    recovery,
  } = state;
  if (!state.draft || !state.snap) return <EditorLoading error={state.error} />;
  return (
    <EditorContext value={state}>
      <div className="editor-shell theme-dark">
        <EditorHeader />
        {(conflict || recovery) && <RecoveryBanner />}

        {(error || notice) && (
          <Notice
            message={error || notice}
            error={!!error}
            onDismiss={() => {
              setError("");
              setNotice("");
            }}
          />
        )}
        <EditorWorkspace />
        {captureOpen && <CaptureDialog />}
        {showProposal && <ProposalDialog />}
      </div>
    </EditorContext>
  );
}
