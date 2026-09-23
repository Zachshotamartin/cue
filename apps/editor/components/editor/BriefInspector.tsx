"use client";
import { ArrowUpRight, Sparkle } from "@phosphor-icons/react";
import Link from "next/link";
import {
  plannerLabel,
  plannerProviderSchema,
  planners,
  type Draft,
} from "../../../../packages/contracts";
import { api, jobOptions, money } from "../client-api";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { useEditor } from "./EditorContext";

export function BriefInspector() {
  const {
    id,
    snap,
    draft,
    tab,
    setNotice,
    busy,
    setShowProposal,
    mutate,
    action,
    leave,
    savedRevision,
    sceneAssets,
    proposals,
    connected,
    selectedPlanner,
  } = useEditor();
  return (
    <>
      {tab === "brand" && (
        <>
          <h2>The film brief.</h2>
          <label>
            What does your product do?
            <Textarea
              rows={4}
              value={draft.description}
              onChange={(e) =>
                mutate((d) => {
                  d.description = e.target.value;
                })
              }
              maxLength={2000}
            />
          </label>
          <label>
            Who is it for?
            <Textarea
              rows={2}
              value={draft.audience}
              onChange={(e) =>
                mutate((d) => {
                  d.audience = e.target.value;
                })
              }
              maxLength={500}
            />
          </label>
          <label>
            Call to action
            <Input
              value={draft.cta}
              onChange={(e) =>
                mutate((d) => {
                  d.cta = e.target.value;
                })
              }
              maxLength={120}
            />
          </label>
          <label>
            Direction
            <Select
              value={draft.treatment}
              onChange={(e) =>
                mutate((d) => {
                  d.treatment = e.target.value as Draft["treatment"];
                })
              }
            >
              <option value="editorial">Editorial / deliberate</option>
              <option value="energetic">Energetic / quick cuts</option>
              <option value="minimal">Minimal / let the product speak</option>
            </Select>
          </label>
          <Button
            className="text-link"
            disabled={!!busy}
            onClick={() =>
              action("palette", async () => {
                const { palette } = await api(`/projects/${id}/palette`);
                if (!palette)
                  throw new Error(
                    "Capture website colors with the extension first, or choose them below.",
                  );
                mutate((d) => {
                  Object.assign(d.brand, palette);
                  d.shots.forEach((s) => (s.background = palette.background));
                });
              })
            }
          >
            Use captured website colors
          </Button>
          <div className="field-pair">
            <label>
              Accent
              <Input
                type="color"
                value={draft.brand.accent}
                onChange={(e) =>
                  mutate((d) => {
                    d.brand.accent = e.target.value;
                  })
                }
              />
            </label>
            <label>
              Text
              <Input
                type="color"
                value={draft.brand.foreground}
                onChange={(e) =>
                  mutate((d) => {
                    d.brand.foreground = e.target.value;
                  })
                }
              />
            </label>
          </div>
          <label>
            Background
            <Input
              type="color"
              value={draft.brand.background}
              onChange={(e) =>
                mutate((d) => {
                  d.brand.background = e.target.value;
                  d.shots.forEach((s) => (s.background = e.target.value));
                })
              }
            />
          </label>
          <label>
            Typography
            <Select
              value={draft.brand.font}
              onChange={(e) =>
                mutate((d) => {
                  d.brand.font = e.target.value as Draft["brand"]["font"];
                })
              }
            >
              <option>Manrope</option>
              <option>Arial</option>
              <option>Georgia</option>
            </Select>
          </label>
          <label>
            Logo
            <Select
              value={draft.brand.logoAssetId || ""}
              onChange={(e) =>
                mutate((d) => {
                  d.brand.logoAssetId = e.target.value || null;
                })
              }
            >
              <option value="">Use product name</option>
              {snap.assets
                .filter((a) => a.kind === "image")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </Select>
          </label>
          <Button
            className="button secondary wide"
            disabled={!!busy || !sceneAssets.length}
            onClick={() =>
              action("storyboard", async () => {
                const revision = await savedRevision();
                await api(`/projects/${id}/storyboard`, {
                  method: "POST",
                  body: JSON.stringify({ revision }),
                });
                setNotice(
                  "Direction applied. Your previous version is in history.",
                );
              })
            }
          >
            Preview this direction
          </Button>
          <div className="inspector-divider" />
          <h3>Ask the director.</h3>
          <label>
            Storyboard planner
            <Select
              value={selectedPlanner}
              onChange={(e) =>
                mutate((d) => {
                  d.plannerProvider = plannerProviderSchema.parse(
                    e.target.value,
                  );
                })
              }
            >
              {plannerProviderSchema.options.map((provider) => (
                <option key={provider} value={provider}>
                  {planners[provider].label}
                  {connected(provider) ? " · Connected" : " · Add API key"}
                </option>
              ))}
            </Select>
          </label>
          <p className="field-help">
            {plannerLabel(selectedPlanner)} receives your included screens and
            brief only when you request a proposal. Review it before applying.
            Budget reservation: {money(planners[selectedPlanner].reserveCents)};
            provider billing applies.
          </p>
          {!connected(selectedPlanner) && (
            <Link
              className="connection-note"
              href="/settings"
              onClick={(e) => leave(e, "/settings")}
            >
              Connect {plannerLabel(selectedPlanner)} ↗
            </Link>
          )}
          <Button
            className="button wide"
            disabled={
              !connected(selectedPlanner) || !sceneAssets.length || !!busy
            }
            onClick={() =>
              action("plan", async () => {
                const revision = await savedRevision();
                await api(
                  `/projects/${id}/plan`,
                  jobOptions({
                    revision,
                    provider: selectedPlanner,
                  }),
                );
                setNotice("The director is preparing a proposal.");
              })
            }
          >
            <Sparkle size={16} />
            Propose a storyboard
          </Button>
          {proposals.map((j) => (
            <Button
              key={j.id}
              className="proposal-link"
              onClick={() => setShowProposal(j.id)}
            >
              {plannerLabel(j.payload.provider)} · Review{" "}
              {j.payload.result.shots.length}-scene proposal{" "}
              <ArrowUpRight size={16} />
            </Button>
          ))}
        </>
      )}
    </>
  );
}
