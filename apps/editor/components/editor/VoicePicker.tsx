"use client";
import { useState } from "react";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { api } from "../client-api";
import { useEditor } from "./EditorContext";
export function VoicePicker() {
  const { voice, setVoice, setError } = useEditor();
  const [voices, setVoices] = useState<
    { id: string; name: string; preview: string | null }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const selected = voices.find((v) => v.id === voice);
  return (
    <div className="voice-picker">
      <Button
        className="text-link"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          try {
            setError("");
            setVoices((await api("/settings/voices")).voices);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? "Loading voices…" : "Browse my ElevenLabs voices"}
      </Button>
      {voices.length > 0 && (
        <label>
          Voice
          <Select value={voice} onChange={(e) => setVoice(e.target.value)}>
            <option value="">Choose a voice</option>
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </label>
      )}
      {selected?.preview && (
        <audio
          controls
          preload="none"
          src={selected.preview}
          aria-label={`Preview ${selected.name}`}
        />
      )}
    </div>
  );
}
