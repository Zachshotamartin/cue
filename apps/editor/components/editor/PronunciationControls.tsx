"use client";
import { useState } from "react";
import { useEditor } from "./EditorContext";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Disclosure } from "../ui/Disclosure";
export function PronunciationControls() {
  const { draft, mutate } = useEditor();
  const [dictionary, setDictionary] = useState(""),
    [version, setVersion] = useState("");
  const valid = /^[\w-]{1,100}$/;
  return (
    <Disclosure title="Product names & pronunciation">
      <p className="field-help">
        Use an ElevenLabs pronunciation dictionary for product names or
        acronyms. Its exact version is saved with new narration jobs; existing
        recordings stay unchanged.
      </p>
      <a
        className="text-link"
        href="https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps"
        target="_blank"
        rel="noreferrer"
      >
        Pronunciation dictionary guide ↗
      </a>
      {draft.pronunciationDictionaries.map((d, i) => (
        <div
          className="sound-cue"
          key={`${d.pronunciation_dictionary_id}:${d.version_id}`}
        >
          <span>
            Dictionary {d.pronunciation_dictionary_id} · version {d.version_id}
          </span>
          <Button
            className="text-link"
            onClick={() =>
              mutate((x) => {
                x.pronunciationDictionaries.splice(i, 1);
              })
            }
          >
            Remove dictionary
          </Button>
        </div>
      ))}
      <label>
        Dictionary ID
        <Input
          value={dictionary}
          maxLength={100}
          onChange={(e) => setDictionary(e.target.value.trim())}
        />
      </label>
      <label>
        Dictionary version
        <Input
          value={version}
          maxLength={100}
          onChange={(e) => setVersion(e.target.value.trim())}
        />
      </label>
      <Button
        className="text-link"
        disabled={
          draft.pronunciationDictionaries.length >= 3 ||
          !valid.test(dictionary) ||
          !valid.test(version) ||
          draft.pronunciationDictionaries.some(
            (d) =>
              d.pronunciation_dictionary_id === dictionary &&
              d.version_id === version,
          )
        }
        onClick={() => {
          mutate((d) => {
            d.pronunciationDictionaries.push({
              pronunciation_dictionary_id: dictionary,
              version_id: version,
            });
          });
          setDictionary("");
          setVersion("");
        }}
      >
        Add dictionary
      </Button>
    </Disclosure>
  );
}
