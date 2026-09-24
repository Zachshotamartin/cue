"use client";
import { useEditor } from "./EditorContext";
import { Textarea } from "../ui/Textarea";
import { Disclosure } from "../ui/Disclosure";
export function NarrationScript() {
  const { draft, mutate } = useEditor();
  return (
    <Disclosure title="Whole-film narration script">
      {draft.shots.map((s, i) => (
        <label key={s.id}>
          {i + 1}. {s.title}
          <Textarea
            rows={2}
            maxLength={1200}
            value={s.narration}
            onChange={(e) =>
              mutate((d) => {
                const shot = d.shots.find((x) => x.id === s.id)!;
                shot.narration = e.target.value;
                shot.narrationAssetId = null;
                shot.speechCues = [];
              })
            }
          />
        </label>
      ))}
      <p className="field-help">
        Read this as one story. Editing a line detaches its old recording and
        captions; generate a new voice-over for that scene.
      </p>
    </Disclosure>
  );
}
