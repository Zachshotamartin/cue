"use client";
import { useFilmPersistence } from "./useFilmPersistence";
import { useJobNotifications } from "./useJobNotifications";
import { type PlayerRef } from "@remotion/player";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import {
  shotSchema,
  type Asset,
  type Shot,
  type Provider,
} from "../../../../packages/contracts";
import { api } from "../client-api";
import { uploadMedia } from "../upload-media";
import { patchShot } from "../../../../packages/director/editing";
import { useWorkspaceLayout } from "./useWorkspaceLayout";
export type InspectorTab = "scene" | "generate" | "audio" | "brand" | "export";
export function useEditorController(id: string) {
  const router = useRouter();
  const workspace = useWorkspaceLayout();
  const [selected, setSelected] = useState(""),
    [library, setLibrary] = useState<"scenes" | "captures">("scenes"),
    [tab, updateTab] = useState<InspectorTab>("scene");
  function setTab(tab: InspectorTab) {
    updateTab(tab);
    workspace.collapse("right", false);
  }
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(""),
    [pairing, setPairing] = useState<{
      code: string;
      expiresIn: number;
      origin: string;
    } | null>(null),
    [captureOpen, setCaptureOpen] = useState(false),
    [model, setModel] = useState("gen4_turbo"),
    [seconds, setSeconds] = useState(5),
    [voice, setVoice] = useState(""),
    [providers, setProviders] = useState<
      { provider: Provider; configured: boolean; suffix?: string }[]
    >([]),
    [showProposal, setShowProposal] = useState<string | null>(null);
  const persistence = useFilmPersistence(id, setError);
  const { snap, draft, draftRef, dirtyRef, mutate, save, refresh } =
    persistence;
  useEffect(() => {
    api("/settings")
      .then((x) => {
        setProviders(x.providers);
        setVoice(x.voiceId);
      })
      .catch(() => {});
  }, []);
  const player = useRef<PlayerRef>(null),
    input = useRef<HTMLInputElement>(null),
    dragId = useRef("");
  const observedJobs = useJobNotifications(
    snap?.jobs || [],
    setNotice,
    setError,
  );
  const actionFlight = useRef(false);
  async function action(name: string, fn: () => Promise<unknown>) {
    if (actionFlight.current) return;
    actionFlight.current = true;
    setBusy(name);
    setError("");
    setNotice("");
    try {
      await fn();
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      actionFlight.current = false;
      setBusy("");
    }
  }
  function leave(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (!dirtyRef.current || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    if (busy) {
      setNotice("Wait for the current operation, then try again.");
      return;
    }
    action("save", async () => {
      await save();
      router.push(href);
    });
  }
  function choose(shot: Shot) {
    setSelected(shot.id);
    setTab("scene");
    const d = draftRef.current!;
    let frame = 0;
    for (const s of d.shots) {
      if (s.id === shot.id) break;
      frame += Math.round(s.duration * 30);
    }
    player.current?.seekTo(
      frame + Math.min(12, Math.round(shot.duration * 30) - 1),
    );
  }
  const shot = draft?.shots.find((s) => s.id === selected) || draft?.shots[0];
  function editShot(patch: Partial<Shot>) {
    if (shot)
      mutate((d) => {
        const s = d.shots.find((x) => x.id === shot.id)!;
        Object.assign(s, patchShot(s, patch));
      });
  }
  function move(shotId: string, at: number) {
    mutate((d) => {
      const index = d.shots.findIndex((s) => s.id === shotId);
      if (index < 0) return;
      const [s] = d.shots.splice(index, 1);
      d.shots.splice(Math.max(0, Math.min(at, d.shots.length)), 0, s);
    });
  }
  function addScene(asset?: Asset) {
    if (draft!.shots.length >= 30) {
      setNotice(
        "A film supports up to 30 scenes. Remove or shorten an existing sequence first.",
      );
      return;
    }
    const s = shotSchema.parse({
      id: crypto.randomUUID(),
      title: String(asset?.metadata.state || asset?.name || "New scene").slice(
        0,
        100,
      ),
      assetId: asset?.id || null,
      template: "showcase",
      mode: "exact-ui",
      duration:
        asset?.kind === "video"
          ? Math.max(
              1,
              Math.min(5, Math.floor((asset.duration || 5) * 30) / 30),
            )
          : 5,
      caption: String(asset?.metadata.title || "").slice(0, 140),
      prompt:
        "A gentle, deliberate camera push toward the main product area. Preserve the interface layout.",
      motion: "push",
      background: draft!.brand.background,
    });
    mutate((d) => d.shots.push(s));
    setSelected(s.id);
    setLibrary("scenes");
    setTab("scene");
  }
  async function upload(files: FileList | File[]) {
    await action("upload", async () => {
      for (const file of Array.from(files)) {
        await uploadMedia(id, file);
      }
      setLibrary("captures");
      setNotice("Media added to the capture library.");
    });
  }
  const sceneAssets =
      snap?.assets.filter(
        (a) =>
          a.kind !== "audio" &&
          !String(a.metadata.state || "").startsWith("export"),
      ) || [],
    audioAssets = snap?.assets.filter((a) => a.kind === "audio") || [];
  const activeJobs =
    snap?.jobs.filter(
      (j) => !["completed", "failed", "cancelled"].includes(j.state),
    ) || [];
  const proposals =
    snap?.jobs.filter(
      (j) => j.kind === "plan" && j.state === "completed" && j.payload.result,
    ) || [];
  const exports =
    snap?.assets.filter((a) => a.metadata.state === "export") || [];
  const selectedTakes = snap?.takes.filter((t) => t.shotId === shot?.id) || [];
  const connected = (p: string) =>
    providers.some((x) => x.provider === p && x.configured);
  const selectedPlanner = draft?.plannerProvider || "gemini";
  const total = draft?.shots.reduce((n, s) => n + s.duration, 0) || 0;

  return {
    ...persistence,
    workspace,
    id,
    router,
    selected,
    setSelected,
    library,
    setLibrary,
    tab,
    setTab,
    error,
    setError,
    notice,
    setNotice,
    busy,
    setBusy,
    pairing,
    setPairing,
    captureOpen,
    setCaptureOpen,
    model,
    setModel,
    seconds,
    setSeconds,
    voice: draft?.narrationVoiceId || voice,
    setVoice: (value: string) =>
      mutate((d) => {
        d.narrationVoiceId = value.slice(0, 80);
      }),
    providers,
    setProviders,
    showProposal,
    setShowProposal,
    player,
    input,
    dragId,
    observedJobs,
    action,
    leave,
    choose,
    shot,
    editShot,
    move,
    addScene,
    upload,
    sceneAssets,
    audioAssets,
    activeJobs,
    proposals,
    exports,
    selectedTakes,
    connected,
    selectedPlanner,
    total,
  };
}
