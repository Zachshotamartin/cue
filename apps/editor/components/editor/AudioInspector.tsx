"use client";
import { NarrationScript } from "./NarrationScript";
import { AudioWaveform } from "./AudioWaveform";
import { SoundStudio } from "./SoundStudio";
import { VoicePicker } from "./VoicePicker";
import { PronunciationControls } from "./PronunciationControls";
import { AudioRights } from "./AudioRights";
import { Microphone, MusicNotes } from "@phosphor-icons/react";
import Link from "next/link";
import { api, assetUrl, jobOptions, money } from "../client-api";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { useEditor } from "./EditorContext";
import { Disclosure } from "../ui/Disclosure";

export function AudioInspector() {
  const {
    id,
    snap,
    draft,
    tab,
    busy,
    voice,
    setVoice,
    input,
    mutate,
    action,
    leave,
    savedRevision,
    shot,
    editShot,
    audioAssets,
    connected,
  } = useEditor();
  return (
    <>
      {tab === "audio" && (
        <>
          <h2>A voice for the story.</h2>
          <NarrationScript />
          {shot && (
            <>
              <label>
                Scene narration
                <Textarea
                  rows={4}
                  value={shot.narration}
                  onChange={(e) =>
                    editShot({
                      narration: e.target.value,
                      narrationAssetId: null,
                      speechCues: [],
                    })
                  }
                  maxLength={1200}
                />
              </label>
              <label>
                Narration recording
                <Select
                  value={shot.narrationAssetId || ""}
                  onChange={(e) =>
                    editShot({
                      narrationAssetId: e.target.value || null,
                      speechCues:
                        snap.jobs.find(
                          (j) => j.outputAssetId === e.target.value,
                        )?.payload.speechCues || [],
                    })
                  }
                >
                  <option value="">No narration</option>
                  {audioAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </label>
              {shot.narrationAssetId && (
                <>
                  <audio
                    className="audio-preview"
                    controls
                    src={assetUrl(shot.narrationAssetId)}
                  />
                  {(audioAssets.find((a) => a.id === shot.narrationAssetId)
                    ?.duration || 0) > shot.duration && (
                    <div>
                      <p className="error">
                        This recording is longer than the scene.
                      </p>
                      {(audioAssets.find((a) => a.id === shot.narrationAssetId)
                        ?.duration || 0) <= 20 && (
                        <Button
                          className="text-link"
                          onClick={() =>
                            editShot({
                              duration:
                                Math.ceil(
                                  (audioAssets.find(
                                    (a) => a.id === shot.narrationAssetId,
                                  )?.duration || shot.duration) * 30,
                                ) / 30,
                            })
                          }
                        >
                          Fit scene to narration
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
              <Disclosure title="Generate a voice-over">
                {!connected("elevenlabs") && (
                  <Link
                    href="/settings"
                    onClick={(e) => leave(e, "/settings")}
                    className="connection-note"
                  >
                    Connect ElevenLabs ↗
                  </Link>
                )}
                <VoicePicker />
                <PronunciationControls />
                <label>
                  Voice ID (optional manual entry)
                  <Input
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    placeholder="Your selected stock voice ID"
                  />
                </label>
                <p className="field-help">
                  Estimated maximum{" "}
                  {money(Math.max(5, Math.ceil(shot.narration.length * 0.04)))}.
                  Uses your provider account.
                </p>
                <Button
                  className="button secondary wide"
                  disabled={
                    !connected("elevenlabs") ||
                    !shot.narration ||
                    !voice ||
                    !!busy
                  }
                  onClick={() =>
                    action("narrate", async () => {
                      const revision = await savedRevision();
                      await api(
                        `/projects/${id}/narrate`,
                        jobOptions({
                          revision,
                          shotId: shot.id,
                          voiceId: voice,
                        }),
                      );
                    })
                  }
                >
                  <Microphone size={16} />
                  Generate narration
                </Button>
              </Disclosure>
            </>
          )}
          <div className="inspector-divider" />
          {draft.musicAssetId && <AudioWaveform assetId={draft.musicAssetId} />}
          <SoundStudio />
          <AudioRights />
          <h3>Film soundtrack</h3>
          <label>
            Music
            <Select
              value={draft.musicAssetId || ""}
              onChange={(e) =>
                mutate((d) => {
                  d.musicAssetId = e.target.value || null;
                })
              }
            >
              <option value="">No soundtrack</option>
              {audioAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </label>
          <label>
            Music level <span>{Math.round(draft.musicVolume * 100)}%</span>
            <Input
              type="range"
              min={0}
              max={0.6}
              step={0.01}
              value={draft.musicVolume}
              onChange={(e) =>
                mutate((d) => {
                  d.musicVolume = +e.target.value;
                })
              }
            />
          </label>
          <p className="field-help">
            Music lowers under narration. Import music you have permission to
            use.
          </p>
          <Button
            className="button secondary wide"
            onClick={() => input.current?.click()}
          >
            <MusicNotes size={16} />
            Import audio
          </Button>
          {snap.jobs
            .filter(
              (j) =>
                j.kind === "narrate" &&
                j.state === "completed" &&
                j.outputAssetId &&
                audioAssets.some((a) => a.id === j.outputAssetId),
            )
            .map((j) => (
              <div className="audio-result" key={j.id}>
                <audio controls src={assetUrl(j.outputAssetId!)} />
                <Button
                  className="text-link"
                  onClick={() =>
                    editShot({
                      narrationAssetId: j.outputAssetId,
                      speechCues: j.payload.speechCues || [],
                    })
                  }
                >
                  Use in selected scene
                </Button>
              </div>
            ))}
        </>
      )}
    </>
  );
}
