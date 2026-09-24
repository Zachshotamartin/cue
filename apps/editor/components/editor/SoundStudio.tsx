"use client";
import { useState } from "react";
import { useEditor } from "./EditorContext";
import { api, jobOptions, money } from "../client-api";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Textarea";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
export function SoundStudio() {
  const {
    id,
    draft,
    snap,
    mutate,
    action,
    savedRevision,
    busy,
    connected,
    audioAssets,
  } = useEditor();
  const [kind, setKind] = useState<"music" | "sound">("music"),
    [prompt, setPrompt] = useState(""),
    [seconds, setSeconds] = useState(15);
  const reserve = kind === "music" ? 200 : 50;
  const completed = snap.jobs.filter(
    (j) =>
      (j.kind === "music" || j.kind === "sound") &&
      j.state === "completed" &&
      j.outputAssetId &&
      audioAssets.some((a) => a.id === j.outputAssetId),
  );
  return (
    <section className="sound-studio">
      <h3>Music & sound design</h3>
      <label>
        Create
        <Select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as typeof kind);
            setSeconds(e.target.value === "music" ? 30 : 2);
          }}
        >
          <option value="music">Instrumental soundtrack</option>
          <option value="sound">Sound effect</option>
        </Select>
      </label>
      <label>
        Describe the sound
        <Textarea
          value={prompt}
          rows={3}
          maxLength={1000}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Soft rhythmic instrumental, warm and deliberate, with a clean ending."
        />
      </label>
      <label>
        Length (seconds)
        <Input
          type="number"
          min={kind === "music" ? 3 : 0.5}
          max={kind === "music" ? 90 : 30}
          step={0.5}
          value={seconds}
          onChange={(e) => setSeconds(+e.target.value)}
        />
      </label>
      <p className="field-help">
        Reserves {money(reserve)} from your project budget. This is a budget
        allowance, not a provider price quote; your ElevenLabs plan determines
        the charge.
      </p>
      <Button
        className="button secondary"
        disabled={!!busy || !connected("elevenlabs") || !prompt.trim()}
        onClick={() =>
          action(kind, async () => {
            await api(
              `/projects/${id}/${kind}`,
              jobOptions({
                revision: await savedRevision(),
                prompt,
                seconds,
                maxCostCents: reserve,
              }),
            );
          })
        }
      >
        Generate {kind === "music" ? "music" : "sound effect"}
      </Button>
      {completed.map((j) => (
        <div className="sound-result" key={j.id}>
          <span>{j.payload.prompt}</span>
          <Button
            className="text-link"
            disabled={j.kind === "sound" && draft.soundCues.length >= 40}
            onClick={() =>
              mutate((d) => {
                if (j.kind === "music") d.musicAssetId = j.outputAssetId;
                else {
                  const a = audioAssets.find((a) => a.id === j.outputAssetId);
                  d.soundCues.push({
                    id: crypto.randomUUID(),
                    assetId: j.outputAssetId!,
                    at: 0,
                    trimStart: 0,
                    duration: Math.min(a?.duration || 2, 30),
                    volume: 0.3,
                    fade: 0.2,
                  });
                }
              })
            }
          >
            Use {j.kind === "music" ? "as soundtrack" : "as cue"}
          </Button>
        </div>
      ))}
      <h3>Sound cues</h3>
      <Button
        className="text-link"
        disabled={!audioAssets.length || draft.soundCues.length >= 40}
        onClick={() =>
          mutate((d) => {
            const a = audioAssets[0];
            d.soundCues.push({
              id: crypto.randomUUID(),
              assetId: a.id,
              at: 0,
              trimStart: 0,
              duration: Math.min(a.duration || 1, 30),
              volume: 0.3,
              fade: 0.2,
            });
          })
        }
      >
        Add an audio cue
      </Button>
      {draft.soundCues.map((c) => (
        <div className="sound-cue" key={c.id}>
          <Select
            aria-label="Cue source"
            value={c.assetId}
            onChange={(e) =>
              mutate((d) => {
                const cue = d.soundCues.find((x) => x.id === c.id)!;
                cue.assetId = e.target.value;
                cue.trimStart = 0;
                cue.duration = Math.min(
                  audioAssets.find((a) => a.id === cue.assetId)?.duration || 1,
                  30,
                );
              })
            }
          >
            {audioAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <div className="field-pair">
            <label>
              At (seconds)
              <Input
                type="number"
                min={0}
                max={300}
                step={0.1}
                value={c.at}
                onChange={(e) =>
                  mutate((d) => {
                    d.soundCues.find((x) => x.id === c.id)!.at =
                      +e.target.value;
                  })
                }
              />
            </label>
            <label>
              Volume
              <Input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={c.volume}
                onChange={(e) =>
                  mutate((d) => {
                    d.soundCues.find((x) => x.id === c.id)!.volume =
                      +e.target.value;
                  })
                }
              />
            </label>
          </div>
          <div className="field-pair">
            {(["trimStart", "duration", "fade"] as const).map((key) => (
              <label key={key}>
                {key === "trimStart"
                  ? "Source start (s)"
                  : key === "duration"
                    ? "Length (s)"
                    : "Fade (s)"}
                <Input
                  type="number"
                  min={key === "duration" ? 0.1 : 0}
                  max={key === "fade" ? 3 : 60}
                  step={0.1}
                  value={c[key]}
                  onChange={(e) =>
                    mutate((d) => {
                      d.soundCues.find((x) => x.id === c.id)![key] =
                        +e.target.value;
                    })
                  }
                />
              </label>
            ))}
          </div>
          <Button
            className="text-link"
            onClick={() =>
              mutate((d) => {
                d.soundCues = d.soundCues.filter((x) => x.id !== c.id);
              })
            }
          >
            Remove cue
          </Button>
        </div>
      ))}
    </section>
  );
}
