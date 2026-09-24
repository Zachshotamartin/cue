"use client";
import { evidenceAssets } from "../../../../packages/director/evidence";
import { api, jobOptions } from "../client-api";
import { Button } from "../ui/Button";
import { useEditor } from "./EditorContext";
export function RecordingAnalysis() {
  const {
    id,
    draft,
    sceneAssets,
    activeJobs,
    busy,
    action,
    savedRevision,
    setNotice,
  } = useEditor();
  const recordings = evidenceAssets(draft, sceneAssets).filter(
    (a) => a.kind === "video",
  );
  if (!recordings.length) return null;
  return (
    <div className="capture-analysis">
      <Button
        className="text-link"
        disabled={
          !!busy ||
          activeJobs.some((j) => j.kind === "analyze" || j.kind === "plan")
        }
        onClick={() =>
          action("analyze", async () => {
            await savedRevision();
            await api(`/projects/${id}/analyze`, jobOptions({}));
            setNotice(
              "Finding useful recording moments. This step does not call an AI provider.",
            );
          })
        }
      >
        Analyze recordings
      </Button>
      <p className="field-help">
        Find action and result frames before editing. Unchanged recordings reuse
        their analysis.
      </p>
    </div>
  );
}
