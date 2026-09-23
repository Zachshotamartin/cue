"use client";
import { ArrowUpRight, Sparkle } from "@phosphor-icons/react";
import Link from "next/link";
import { api, jobOptions, money } from "../client-api";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { useEditor } from "./EditorContext";
import { TakeCard } from "./TakeCard";

export function GenerateInspector() {
  const {
    id,
    tab,
    setNotice,
    busy,
    model,
    setModel,
    seconds,
    setSeconds,
    action,
    leave,
    savedRevision,
    shot,
    editShot,
    selectedTakes,
    connected,
  } = useEditor();
  return (
    <>
      {tab === "generate" &&
        (shot ? (
          <>
            <h2>Give this scene movement.</h2>
            <p className="field-help">
              Each generation becomes a new take. Your source stays untouched.
            </p>
            {!connected("runway") && (
              <Link
                href="/settings"
                onClick={(e) => leave(e, "/settings")}
                className="connection-note"
              >
                Connect Runway to generate <ArrowUpRight size={15} />
              </Link>
            )}
            <label>
              Motion direction
              <Textarea
                rows={5}
                value={shot.prompt}
                maxLength={1000}
                onChange={(e) => editShot({ prompt: e.target.value })}
              />
            </label>
            <label>
              Model
              <Select value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="gen4_turbo">Gen-4 Turbo</option>
                <option value="gen4.5">Gen-4.5</option>
              </Select>
            </label>
            <label>
              Generated length
              <Select
                value={seconds}
                onChange={(e) => setSeconds(+e.target.value)}
              >
                <option value={5}>5 seconds</option>
                <option value={10}>10 seconds</option>
              </Select>
            </label>
            <div className="cost-summary">
              <span>Estimated generation</span>
              <strong>
                {money((model === "gen4_turbo" ? 5 : 12) * seconds)}
              </strong>
            </div>
            <Button
              className="button wide"
              disabled={!!busy || !connected("runway") || !shot.assetId}
              onClick={() =>
                action("generate", async () => {
                  const revision = await savedRevision();
                  await api(
                    `/projects/${id}/generate`,
                    jobOptions({
                      revision,
                      shotId: shot.id,
                      model,
                      seconds,
                      maxCostCents: (model === "gen4_turbo" ? 5 : 12) * seconds,
                    }),
                  );
                  setNotice("Generation queued. You can keep editing.");
                })
              }
            >
              <Sparkle size={17} />
              Generate take
            </Button>
            <h3 className="subsection-title">Your takes</h3>
            {selectedTakes.length ? (
              selectedTakes.map((t) => <TakeCard key={t.id || "item"} t={t} />)
            ) : (
              <p className="muted small-copy">
                Your generated takes will appear here for comparison.
              </p>
            )}
          </>
        ) : (
          <p>Select a scene first.</p>
        ))}
    </>
  );
}
