import { credential } from "../storage/credentials";
import { readBounded } from "../storage/media";
import { ProviderError } from "./index";
import type { Draft, Shot } from "../contracts";
async function request(owner: string, route: string, body?: unknown) {
  const key = await credential(owner, "elevenlabs");
  const r = await fetch(`https://api.elevenlabs.io${route}`, {
    redirect: "error",
    method: body ? "POST" : "GET",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(body ? 180000 : 20000),
  });
  if (!r.ok)
    throw new ProviderError(
      r.status === 401
        ? "ElevenLabs rejected this key. Update it in Settings."
        : r.status === 402
          ? "Your ElevenLabs account needs more credits."
          : r.status === 429
            ? "ElevenLabs is busy. Try again after checking your jobs."
            : `ElevenLabs could not complete this request (${r.status}).`,
      r.status < 500,
    );
  return r;
}
export async function listVoices(owner: string) {
  const data = JSON.parse(
    (
      await readBounded(
        (await request(owner, "/v2/voices?page_size=100")).body,
        2 * 1024 * 1024,
      )
    ).toString(),
  );
  return (data.voices || [])
    .slice(0, 100)
    .map((v: { voice_id: string; name: string; preview_url?: string }) => ({
      id: v.voice_id,
      name: v.name,
      preview: v.preview_url?.startsWith("https://") ? v.preview_url : null,
    }));
}
export function alignmentCues(
  alignment:
    | {
        characters: string[];
        character_start_times_seconds: number[];
        character_end_times_seconds: number[];
      }
    | undefined,
): Shot["speechCues"] {
  if (!alignment) return [];
  const cues: Shot["speechCues"] = [];
  let text = "",
    start = 0,
    end = 0;
  for (let i = 0; i < alignment.characters.length; i++) {
    const from = alignment.character_start_times_seconds[i],
      to = alignment.character_end_times_seconds[i];
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) continue;
    if (!text) start = from;
    text += alignment.characters[i];
    end = to;
    if (
      (text.length >= 38 && /\s|[.!?]/.test(alignment.characters[i])) ||
      text.length >= 80
    ) {
      cues.push({ start, end, text: text.trim() });
      text = "";
    }
  }
  if (text.trim()) cues.push({ start, end, text: text.trim() });
  return cues.filter((c) => c.end > c.start).slice(0, 100);
}
export async function timedSpeech(
  owner: string,
  text: string,
  voiceId: string,
  dictionaries: Draft["pronunciationDictionaries"] = [],
) {
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(voiceId))
    throw new Error("Choose a valid voice.");
  const response = await request(
    owner,
    `/v1/text-to-speech/${voiceId}/with-timestamps`,
    {
      text,
      model_id: "eleven_multilingual_v2",
      ...(dictionaries.length
        ? { pronunciation_dictionary_locators: dictionaries }
        : {}),
    },
  );
  const data = JSON.parse(
    (await readBounded(response.body, 18 * 1024 * 1024)).toString(),
  );
  if (typeof data.audio_base64 !== "string")
    throw new ProviderError("ElevenLabs returned no audio.", true, true);
  return {
    buffer: Buffer.from(data.audio_base64, "base64"),
    cues: alignmentCues(data.alignment || data.normalized_alignment),
  };
}
export async function generateSound(
  owner: string,
  kind: "music" | "sound",
  prompt: string,
  seconds: number,
) {
  const r = await request(
    owner,
    kind === "music" ? "/v1/music" : "/v1/sound-generation",
    kind === "music"
      ? {
          prompt,
          music_length_ms: Math.round(seconds * 1000),
          force_instrumental: true,
          model_id: "music_v1",
        }
      : {
          text: prompt,
          duration_seconds: seconds,
          model_id: "eleven_text_to_sound_v2",
        },
  );
  return readBounded(r.body, 24 * 1024 * 1024);
}
