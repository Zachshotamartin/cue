"use client";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { useEditor } from "./EditorContext";
import type { Draft } from "../../../../packages/contracts";
export function ProductBrief() {
  const { draft, mutate } = useEditor();
  const update = (patch: Partial<Draft>) =>
    mutate((d) => Object.assign(d, patch));
  return (
    <div className="brief-fields">
      <label>
        Product name
        <Input
          value={draft.productName}
          placeholder={draft.title}
          maxLength={100}
          onChange={(e) => update({ productName: e.target.value })}
        />
      </label>
      <label>
        What are we making?
        <Select
          value={draft.objective}
          onChange={(e) =>
            update({ objective: e.target.value as Draft["objective"] })
          }
        >
          <option value="auto">Choose from the available evidence</option>
          <option value="demonstration">Show the product in use</option>
          <option value="teaser">A website or launch teaser</option>
        </Select>
      </label>
      <div className="field-pair">
        <label>
          Target length
          <Select
            value={draft.targetSeconds}
            onChange={(e) => update({ targetSeconds: Number(e.target.value) })}
          >
            {[15, 30, 45, 60, 90].map((n) => (
              <option key={n} value={n}>
                {n} seconds
              </option>
            ))}
          </Select>
        </label>
        <label>
          Destination
          <Select
            value={draft.channel}
            onChange={(e) =>
              update({ channel: e.target.value as Draft["channel"] })
            }
          >
            <option value="website">Website</option>
            <option value="social">Social</option>
            <option value="presentation">Presentation</option>
          </Select>
        </label>
      </div>
      <label>
        Priority features
        <Textarea
          rows={2}
          value={draft.features.join("\n")}
          placeholder="One feature per line"
          onChange={(e) =>
            update({
              features: e.target.value
                .split("\n")
                .slice(0, 8)
                .map((s) => s.slice(0, 150)),
            })
          }
        />
      </label>
      <label>
        The action and the result
        <Textarea
          rows={3}
          maxLength={1000}
          value={draft.journey}
          placeholder="For example: upload a recording, select a voice, then hear the extracted speech."
          onChange={(e) => update({ journey: e.target.value })}
        />
      </label>
      <label>
        Destination URL
        <Input
          type="url"
          value={draft.ctaUrl}
          placeholder={draft.siteUrl || "https://"}
          onChange={(e) => update({ ctaUrl: e.target.value })}
        />
      </label>
    </div>
  );
}
