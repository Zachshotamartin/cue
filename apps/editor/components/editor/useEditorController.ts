"use client";
import { type PlayerRef } from "@remotion/player";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  shotSchema,
  type Asset,
  type Draft,
  type Shot,
  type Snapshot,
} from "../../../../packages/contracts";
import { api } from "../client-api";
import { useWorkspaceLayout } from "./useWorkspaceLayout";
export type InspectorTab = "scene" | "generate" | "audio" | "brand" | "export";
function clearRecovery(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* Cloud saves remain authoritative when browser storage is unavailable. */
  }
}

export function useEditorController(id: string) {
  const router = useRouter();
  const workspace = useWorkspaceLayout();
  const [snap, setSnap] = useState<Snapshot | null>(null),
    [draft, setDraft] = useState<Draft | null>(null),
    [selected, setSelected] = useState(""),
    [library, setLibrary] = useState<"scenes" | "captures">("scenes"),
    [tab, updateTab] = useState<InspectorTab>("scene");
  function setTab(tab: InspectorTab) {
    updateTab(tab);
    workspace.collapse("right", false);
  }
  const [dirty, setDirty] = useState(false),
    dirtyRef = useRef(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(""),
    [pairing, setPairing] = useState<any>(null),
    [captureOpen, setCaptureOpen] = useState(false),
    [model, setModel] = useState("gen4_turbo"),
    [seconds, setSeconds] = useState(5),
    [voice, setVoice] = useState(""),
    [providers, setProviders] = useState<any[]>([]),
    [showProposal, setShowProposal] = useState<string | null>(null);
  const player = useRef<PlayerRef>(null),
    input = useRef<HTMLInputElement>(null),
    dragId = useRef(""),
    history = useRef<Draft[]>([]),
    future = useRef<Draft[]>([]);
  const observedJobs = useRef(new Map<string, string>());
  const actionFlight = useRef(false);
  useEffect(() => {
    for (const job of snap?.jobs || []) {
      const previous = observedJobs.current.get(job.id);
      if (previous && previous !== job.state) {
        if (job.state === "completed")
          setNotice(
            job.kind === "render"
              ? "Your film is ready. Open Export to watch or download it."
              : job.kind === "generate"
                ? "A new take is ready in Generate."
                : job.kind === "plan"
                  ? "Your storyboard proposal is ready in Brief."
                  : "Narration is ready in Audio.",
          );
        if (job.state === "failed" || job.state === "unknown")
          setError(
            job.error || "A job needs attention. Open Export for details.",
          );
      }
      observedJobs.current.set(job.id, job.state);
    }
  }, [snap]);
  const [saveState, setSaveState] = useState("Saved"),
    [conflict, setConflict] = useState(false);
  const [recovery, setRecovery] = useState<{
    draft: Draft;
    revision: number;
  } | null>(null);
  const baseRevision = useRef(0),
    ownerRef = useRef(""),
    saveFlight = useRef<Promise<any> | null>(null),
    firstLoad = useRef(true);
  const conflictRef = useRef(false);
  const recoveryKey = () => `cue:recovery:${ownerRef.current}:${id}`;
  function preserve(value: Draft, revision = baseRevision.current) {
    if (!ownerRef.current) return;
    try {
      localStorage.setItem(
        recoveryKey(),
        JSON.stringify({ draft: value, revision, at: Date.now() }),
      );
    } catch {
      setSaveState(
        "Browser recovery unavailable — keep this tab open until saved",
      );
    }
  }
  const draftRef = useRef<Draft | null>(null);
  draftRef.current = draft;
  const refresh = useCallback(async () => {
    const data = await api<Snapshot>(`/projects/${id}`);
    ownerRef.current = data.project.owner;
    setSnap(data);
    if (!dirtyRef.current && !saveFlight.current) {
      baseRevision.current = data.project.revision;
      setDraft(data.project.draft);
      draftRef.current = data.project.draft;
    }
    if (firstLoad.current) {
      firstLoad.current = false;
      try {
        const raw = localStorage.getItem(recoveryKey());
        if (raw) {
          const r = JSON.parse(raw);
          if (
            r.draft &&
            JSON.stringify(r.draft) !== JSON.stringify(data.project.draft)
          )
            setRecovery(r);
          else clearRecovery(recoveryKey());
        }
      } catch {}
    }
  }, [id]);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    api("/settings")
      .then((x) => {
        setProviders(x.providers);
        setVoice(x.voiceId);
      })
      .catch(() => {});
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh().catch(() => {});
    }, 4000);
    const visible = () => {
      if (document.visibilityState === "visible") refresh().catch(() => {});
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [id, refresh]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, []);
  function mutate(fn: (d: Draft) => void) {
    if (!draftRef.current) return;
    history.current.push(structuredClone(draftRef.current));
    history.current = history.current.slice(-60);
    future.current = [];
    const d = structuredClone(draftRef.current);
    fn(d);
    draftRef.current = d;
    setDraft(d);
    dirtyRef.current = true;
    setDirty(true);
    setSaveState("Unsaved changes");
    preserve(d);
  }
  function undo(redo = false) {
    const source = redo ? future.current : history.current,
      target = redo ? history.current : future.current,
      d = source.pop();
    if (!d || !draftRef.current) return;
    target.push(draftRef.current);
    draftRef.current = d;
    setDraft(d);
    dirtyRef.current = true;
    setDirty(true);
    setSaveState("Unsaved changes");
    preserve(d);
  }
  async function save(): Promise<any> {
    if (saveFlight.current) return saveFlight.current;
    if (conflictRef.current)
      throw new Error("Resolve the save conflict before continuing.");
    if (!draftRef.current || !baseRevision.current) return;
    const operation = (async () => {
      let result: any;
      while (dirtyRef.current) {
        const value = draftRef.current!;
        setSaveState("Saving…");
        preserve(value);
        try {
          const r = await api(`/projects/${id}/edits`, {
            method: "POST",
            body: JSON.stringify({
              revision: baseRevision.current,
              draft: value,
              label: "Edit film",
            }),
          });
          result = r.project;
          baseRevision.current = r.project.revision;
          setSnap(
            (previous) => previous && { ...previous, project: r.project },
          );
          if (draftRef.current === value) {
            dirtyRef.current = false;
            setDirty(false);
            clearRecovery(recoveryKey());
            setSaveState("Saved to your account");
          } else preserve(draftRef.current!);
        } catch (e: any) {
          if (e.status === 409) {
            conflictRef.current = true;
            setConflict(true);
            setSaveState("Changes in another tab — resolve conflict");
          } else setSaveState("Not saved — edits kept in this browser");
          throw e;
        }
      }
      return result || snap?.project;
    })();
    saveFlight.current = operation;
    try {
      return await operation;
    } finally {
      saveFlight.current = null;
    }
  }
  useEffect(() => {
    if (!dirty || conflict) return;
    const timer = setTimeout(() => {
      save().catch(() => {});
    }, 900);
    return () => clearTimeout(timer);
  }, [draft, dirty, conflict]);
  useEffect(() => {
    const online = () => {
      if (dirtyRef.current && !conflictRef.current) save().catch(() => {});
    };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, []);
  async function resolveSave(keepEdits: boolean) {
    const latest = await api<Snapshot>(`/projects/${id}`);
    baseRevision.current = latest.project.revision;
    setSnap(latest);
    conflictRef.current = false;
    setConflict(false);
    if (keepEdits) {
      await save();
    } else {
      setDraft(latest.project.draft);
      draftRef.current = latest.project.draft;
      dirtyRef.current = false;
      setDirty(false);
      clearRecovery(recoveryKey());
      setSaveState("Saved to your account");
    }
  }
  async function action(name: string, fn: () => Promise<any>) {
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
  async function savedRevision() {
    if (dirtyRef.current) {
      const p = await save();
      return p?.revision;
    }
    return snap?.project.revision;
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
        Object.assign(s, patch);
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
    const s = shotSchema.parse({
      id: crypto.randomUUID(),
      title: asset?.metadata.state || asset?.name || "New scene",
      assetId: asset?.id || null,
      template: "showcase",
      mode: "exact-ui",
      duration: 5,
      caption: asset?.metadata.title || "",
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
        if (file.size > 64 * 1024 * 1024)
          throw new Error(`${file.name} exceeds 64 MiB.`);
        const buffer = await file.arrayBuffer();
        const digest = Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)),
        )
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("");
        const upload = await api(`/projects/${id}/uploads`, {
          method: "POST",
          body: JSON.stringify({
            name: file.name,
            bytes: file.size,
            hash: digest,
          }),
        });
        for (let i = 0; i < upload.chunks; i++)
          await api(`/uploads/${upload.id}/chunks/${i}`, {
            method: "PUT",
            headers: { "Content-Type": "application/octet-stream" },
            body: buffer.slice(
              i * 1048576,
              Math.min(buffer.byteLength, (i + 1) * 1048576),
            ),
          });
        await api(`/uploads/${upload.id}/complete`, { method: "POST" });
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
    workspace,
    id,
    router,
    snap,
    setSnap,
    draft,
    setDraft,
    selected,
    setSelected,
    library,
    setLibrary,
    tab,
    setTab,
    dirty,
    setDirty,
    dirtyRef,
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
    voice,
    setVoice,
    providers,
    setProviders,
    showProposal,
    setShowProposal,
    player,
    input,
    dragId,
    history,
    future,
    observedJobs,
    saveState,
    setSaveState,
    conflict,
    setConflict,
    recovery,
    setRecovery,
    baseRevision,
    ownerRef,
    saveFlight,
    firstLoad,
    conflictRef,
    recoveryKey,
    preserve,
    draftRef,
    refresh,
    mutate,
    undo,
    save,
    resolveSave,
    action,
    leave,
    savedRevision,
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
