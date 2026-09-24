"use client";
import { useEditor } from "./EditorContext";
import { Disclosure } from "../ui/Disclosure";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
export function EmphasisEditor() {
  const { shot, editShot } = useEditor();
  if (!shot) return null;
  const update = (
    index: number,
    patch: Partial<(typeof shot.emphasis)[number]>,
  ) =>
    editShot({
      emphasis: shot.emphasis.map((e, i) =>
        i === index
          ? { ...e, ...patch, label: patch.label?.slice(0, 80) ?? e.label }
          : e,
      ),
    });
  return (
    <Disclosure title={`Highlights & callouts (${shot.emphasis.length})`}>
      <p className="field-help">
        Use Click emphasis in the crop view to place a marker, or add one here.
        Timing follows the source when you trim or change speed.
      </p>
      <Button
        className="text-link"
        disabled={shot.emphasis.length >= 20}
        onClick={() =>
          editShot({
            emphasis: [
              ...shot.emphasis,
              { at: 0, duration: 1, x: 0.5, y: 0.5, label: "" },
            ],
          })
        }
      >
        Add highlight
      </Button>
      {shot.emphasis.map((e, i) => (
        <div className="sound-cue" key={i}>
          <label>
            Callout {i + 1}
            <Input
              value={e.label}
              maxLength={80}
              placeholder="Optional short label"
              onChange={(ev) => update(i, { label: ev.target.value })}
            />
          </label>
          <div className="field-pair">
            <label>
              At (seconds)
              <Input
                type="number"
                min={0}
                max={shot.duration}
                step={0.1}
                value={e.at}
                onChange={(ev) =>
                  update(i, {
                    at: Math.max(0, Math.min(shot.duration, +ev.target.value)),
                  })
                }
              />
            </label>
            <label>
              Hold (seconds)
              <Input
                type="number"
                min={0.2}
                max={10}
                step={0.1}
                value={e.duration}
                onChange={(ev) =>
                  update(i, {
                    duration: Math.max(0.2, Math.min(10, +ev.target.value)),
                  })
                }
              />
            </label>
            {(["x", "y"] as const).map((key) => (
              <label key={key}>
                {key === "x" ? "Across (%)" : "Down (%)"}
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={Math.round(e[key] * 100)}
                  onChange={(ev) =>
                    update(i, {
                      [key]: Math.max(0, Math.min(1, +ev.target.value / 100)),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <Button
            className="text-link"
            onClick={() =>
              editShot({ emphasis: shot.emphasis.filter((_, n) => n !== i) })
            }
          >
            Remove highlight
          </Button>
        </div>
      ))}
    </Disclosure>
  );
}
