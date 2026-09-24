"use client";
import { inspectFilm } from "../../../../packages/director/quality";
import { Button } from "../ui/Button";
import { useEditor } from "./EditorContext";
export function QualityPanel() {
  const { draft, snap, choose } = useEditor();
  const issues = inspectFilm(draft, snap.assets, snap.takes);
  return (
    <section className="quality-panel" aria-label="Film checks">
      <h3>Before you export</h3>
      {issues.length ? (
        <ul>
          {issues.map((issue, i) => (
            <li
              key={`${issue.code}-${i}`}
              className={issue.blocking ? "error" : ""}
            >
              {issue.message}
              {issue.sceneId && (
                <Button
                  className="text-link"
                  onClick={() => {
                    const s = draft.shots.find((s) => s.id === issue.sceneId);
                    if (s) choose(s);
                  }}
                >
                  Review scene
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>
          Source timing and caption length checks pass. Watch the full cut to
          check the story, privacy and sound.
        </p>
      )}
    </section>
  );
}
