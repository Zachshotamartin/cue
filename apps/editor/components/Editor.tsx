"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Player, type PlayerRef } from "@remotion/player";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowUp,
  ArrowDown,
  ArrowsClockwise,
  Check,
  Copy,
  DownloadSimple,
  FilmStrip,
  GearSix,
  ImageSquare,
  Plus,
  UploadSimple,
  X,
  Trash,
  ArrowCounterClockwise,
  ArrowClockwise,
  CircleNotch,
  Microphone,
  MusicNotes,
  Sparkle,
  LinkSimple,
  CaretRight,
} from "@phosphor-icons/react";
import { Film } from "../../../packages/compositor/Film";
import {
  dimensions,
  durationFrames,
  shotSchema,
  type Draft,
  type Shot,
  type Snapshot,
  type Asset,
} from "../../../packages/contracts";
import { api, assetUrl, jobOptions, money } from "./client-api";
import { Logo } from "./Logo";
import { useModalFocus } from "./useModalFocus";

type InspectorTab = "scene" | "generate" | "audio" | "brand" | "export";
export function Editor({ id }: { id: string }) {
  const router = useRouter();
  const [snap, setSnap] = useState<Snapshot | null>(null),
    [draft, setDraft] = useState<Draft | null>(null),
    [selected, setSelected] = useState(""),
    [library, setLibrary] = useState<"scenes" | "captures">("scenes"),
    [tab, setTab] = useState<InspectorTab>("scene");
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
  useModalFocus(captureOpen || !!showProposal, () => {
    setCaptureOpen(false);
    setShowProposal(null);
  });
  const observedJobs = useRef(new Map<string, string>());
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
          else localStorage.removeItem(recoveryKey());
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
            localStorage.removeItem(recoveryKey());
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
      localStorage.removeItem(recoveryKey());
      setSaveState("Saved to your account");
    }
  }
  async function action(name: string, fn: () => Promise<any>) {
    if (busy) return;
    setBusy(name);
    setError("");
    setNotice("");
    try {
      await fn();
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
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
  const total = draft?.shots.reduce((n, s) => n + s.duration, 0) || 0;
  if (!draft || !snap)
    return (
      <div className="editor-loading">
        <Logo />
        <p>{error || "Opening your film…"}</p>
        <Link href="/projects">Back to studio</Link>
      </div>
    );
  return (
    <div className="editor-shell">
      <header className="editor-header">
        <div className="editor-title">
          <Link
            href="/projects"
            onClick={(e) => leave(e, "/projects")}
            className="icon-button"
            aria-label="Back to films"
          >
            <ArrowLeft size={19} />
          </Link>
          <Link href="/" onClick={(e) => leave(e, "/")} className="brand-link">
            <Logo />
          </Link>
          <span className="header-divider" />
          <input
            className="film-title-input"
            aria-label="Film title"
            value={draft.title}
            onChange={(e) =>
              mutate((d) => {
                d.title = e.target.value;
              })
            }
          />
          <span className="save-state">{saveState}</span>
        </div>
        <div className="editor-header-actions">
          <button
            className="icon-button"
            aria-label="Undo edit"
            disabled={!history.current.length}
            onClick={() => undo()}
          >
            <ArrowCounterClockwise size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Redo edit"
            disabled={!future.current.length}
            onClick={() => undo(true)}
          >
            <ArrowClockwise size={18} />
          </button>
          <Link
            href="/settings"
            onClick={(e) => leave(e, "/settings")}
            className="icon-button"
            aria-label="Provider settings"
          >
            <GearSix size={19} />
          </Link>
          <button
            className="button secondary small"
            disabled={!dirty || !!busy}
            onClick={() => action("save", save)}
          >
            {busy === "save" ? "Saving…" : "Save"}
          </button>
          <button className="button small" onClick={() => setTab("export")}>
            <DownloadSimple size={16} />
            Export
          </button>
        </div>
      </header>
      {(conflict || recovery) && (
        <section className="recovery-banner" role="status">
          <p>
            {conflict
              ? "This project changed in another tab. Your edits are safe here. Choose which version to keep."
              : "This browser has edits that did not finish saving. Restore them, or keep the cloud version."}
          </p>
          <button
            className="button small"
            onClick={() =>
              action("recover", async () => {
                if (recovery) {
                  const latest = await api<Snapshot>(`/projects/${id}`);
                  baseRevision.current = latest.project.revision;
                  draftRef.current = recovery.draft;
                  setDraft(recovery.draft);
                  dirtyRef.current = true;
                  setDirty(true);
                  setRecovery(null);
                  await save();
                } else await resolveSave(true);
              })
            }
          >
            {recovery ? "Restore my edits" : "Keep my edits"}
          </button>
          <button
            className="button small secondary"
            onClick={() =>
              action("recover", async () => {
                setRecovery(null);
                await resolveSave(false);
              })
            }
          >
            Use cloud version
          </button>
        </section>
      )}

      {(error || notice) && (
        <div
          className={`editor-banner ${error ? "error" : ""}`}
          role={error ? "alert" : "status"}
        >
          <span>{error || notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss"
            onClick={() => {
              setError("");
              setNotice("");
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}
      <div className="editor-body">
        <aside className="source-panel">
          <div className="panel-tabs">
            <button
              className={library === "scenes" ? "active" : ""}
              onClick={() => setLibrary("scenes")}
            >
              Scenes <span>{draft.shots.length}</span>
            </button>
            <button
              className={library === "captures" ? "active" : ""}
              onClick={() => setLibrary("captures")}
            >
              Captures <span>{sceneAssets.length}</span>
            </button>
          </div>
          <div className="source-scroll">
            {library === "scenes" ? (
              <>
                {draft.shots.map((s, i) => {
                  const a = snap.assets.find((a) => a.id === s.assetId);
                  return (
                    <div
                      className={`scene-card ${shot?.id === s.id ? "selected" : ""}`}
                      key={s.id}
                      draggable
                      onDragStart={() => {
                        dragId.current = s.id;
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        move(dragId.current, i);
                      }}
                    >
                      <button className="scene-pick" onClick={() => choose(s)}>
                        <div className="scene-thumbnail">
                          {a?.kind === "image" ? (
                            <img src={assetUrl(a.id)} alt="" />
                          ) : a?.kind === "video" ? (
                            <video
                              src={assetUrl(a.id)}
                              muted
                              preload="metadata"
                            />
                          ) : (
                            <FilmStrip size={30} weight="thin" />
                          )}
                          <span>{String(i + 1).padStart(2, "0")}</span>
                        </div>
                        <div className="scene-meta">
                          <strong>{s.title}</strong>
                          <small>
                            {s.duration}s{" "}
                            <span>
                              {s.mode === "exact-ui"
                                ? "Exact UI"
                                : s.mode === "hybrid"
                                  ? "Hybrid"
                                  : "Generated"}
                            </span>
                          </small>
                        </div>
                      </button>
                      <div className="scene-move">
                        <button
                          aria-label={`Move ${s.title} earlier`}
                          disabled={i === 0}
                          onClick={() => move(s.id, i - 1)}
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          aria-label={`Move ${s.title} later`}
                          disabled={i === draft.shots.length - 1}
                          onClick={() => move(s.id, i + 1)}
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!draft.shots.length && (
                  <div className="panel-empty">
                    <FilmStrip size={33} weight="thin" />
                    <h3>A story starts here.</h3>
                    <p>
                      Capture your website or import a few screens to build your
                      first cut.
                    </p>
                    <button
                      className="button small"
                      onClick={() => setCaptureOpen(true)}
                    >
                      Add captures
                    </button>
                  </div>
                )}
                <button
                  className="add-scene"
                  onClick={() => addScene(sceneAssets[0])}
                >
                  <Plus size={16} />
                  Add scene
                </button>
              </>
            ) : (
              <>
                <button
                  className="button secondary small wide"
                  onClick={() => setCaptureOpen(true)}
                >
                  <Plus size={16} />
                  Add captures
                </button>
                {sceneAssets.length === 0 && (
                  <p className="muted small-copy">
                    Your original screens and recordings will appear here.
                  </p>
                )}
                {sceneAssets.map((a) => (
                  <article className="capture-card" key={a.id}>
                    {a.kind === "image" ? (
                      <img src={assetUrl(a.id)} alt={a.name} />
                    ) : (
                      <video src={assetUrl(a.id)} controls preload="metadata" />
                    )}
                    <strong>{a.metadata.state || a.name}</strong>
                    <small>
                      {a.width} × {a.height}
                      {a.duration ? ` · ${a.duration.toFixed(1)}s` : ""}
                    </small>
                    <label className="include-capture">
                      <input
                        type="checkbox"
                        checked={!draft.excludedAssetIds.includes(a.id)}
                        onChange={(e) =>
                          mutate((d) => {
                            d.excludedAssetIds = e.target.checked
                              ? d.excludedAssetIds.filter((id) => id !== a.id)
                              : [...d.excludedAssetIds, a.id];
                          })
                        }
                      />
                      Include in AI direction
                    </label>
                    <div className="capture-actions">
                      <button className="text-link" onClick={() => addScene(a)}>
                        Add scene <Plus size={13} />
                      </button>
                      {shot && (
                        <button
                          className="text-link"
                          onClick={() => {
                            editShot({ assetId: a.id, selectedTakeId: null });
                            setNotice("Scene source updated.");
                          }}
                        >
                          Use in scene
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </>
            )}
          </div>
          <div className="source-footer">
            <button className="text-link" onClick={() => setCaptureOpen(true)}>
              <LinkSimple size={16} /> Capture a website
            </button>
            <button
              className="text-link"
              onClick={() => input.current?.click()}
            >
              <UploadSimple size={16} /> Import media
            </button>
            <input
              ref={input}
              hidden
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/avif,video/mp4,video/webm,audio/*"
              onChange={(e) => {
                if (e.target.files) upload(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </aside>
        <main className="stage-panel">
          <div className="stage-toolbar">
            <div>
              <span className="stage-label">THE FIRST CUT</span>
              <span>
                {draft.format === "landscape"
                  ? "16:9"
                  : draft.format === "portrait"
                    ? "9:16"
                    : "1:1"}
              </span>
            </div>
            <div className="stage-controls">
              <select
                aria-label="Film format"
                value={draft.format}
                onChange={(e) =>
                  mutate((d) => {
                    d.format = e.target.value as Draft["format"];
                  })
                }
              >
                <option value="landscape">Landscape</option>
                <option value="portrait">Portrait</option>
                <option value="square">Square</option>
              </select>
              <button className="text-link" onClick={() => setTab("brand")}>
                Film brief <CaretRight size={13} />
              </button>
            </div>
          </div>
          <div className={`preview-stage ${draft.format}`}>
            {draft.shots.length ? (
              <Player
                ref={player}
                component={Film}
                inputProps={{
                  draft,
                  assets: snap.assets,
                  takes: snap.takes,
                  urls: Object.fromEntries(
                    snap.assets.map((a) => [a.id, assetUrl(a.id)]),
                  ),
                  fontUrl: "/brand/manrope.woff2",
                }}
                initialFrame={12}
                durationInFrames={durationFrames(draft)}
                fps={30}
                compositionWidth={dimensions(draft.format).width}
                compositionHeight={dimensions(draft.format).height}
                controls
                style={{
                  width: "100%",
                  maxHeight: "100%",
                  aspectRatio: `${dimensions(draft.format).width}/${dimensions(draft.format).height}`,
                }}
                acknowledgeRemotionLicense
              />
            ) : (
              <div className="stage-empty">
                <img
                  src="/brand/frames.png"
                  alt="Glass frames ready for your product"
                />
                <div>
                  <h2>
                    Your opening scene
                    <br />
                    is waiting.
                  </h2>
                  <p>Add real screens. Give them a direction.</p>
                  <button
                    className="button"
                    onClick={() => setCaptureOpen(true)}
                  >
                    <Plus size={17} />
                    Add captures
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="timeline-head">
            <span>
              {draft.shots.length} scenes <span className="muted">/</span>{" "}
              {total.toFixed(1)} seconds
            </span>
            <div>
              <button
                className="text-link"
                disabled={!sceneAssets.length || !!busy}
                onClick={() =>
                  action("storyboard", async () => {
                    const revision = await savedRevision();
                    await api(`/projects/${id}/storyboard`, {
                      method: "POST",
                      body: JSON.stringify({ revision }),
                    });
                    history.current = [];
                    setLibrary("scenes");
                    setNotice(
                      "Starter storyboard created. Every scene is editable.",
                    );
                  })
                }
              >
                Build a starter cut
              </button>
              <button
                className="text-link"
                disabled={!sceneAssets.length || !!busy}
                onClick={() => {
                  setTab("brand");
                  setNotice(
                    connected("gemini")
                      ? "Set your brief, then ask the director for a proposal."
                      : "Connect Gemini in Settings to use AI direction.",
                  );
                }}
              >
                <Sparkle size={14} />
                AI director
              </button>
            </div>
          </div>
          <div className="timeline" aria-label="Film timeline">
            {draft.shots.map((s, i) => {
              const a = snap.assets.find((a) => a.id === s.assetId);
              return (
                <button
                  key={s.id}
                  className={`timeline-shot ${shot?.id === s.id ? "selected" : ""}`}
                  onClick={() => choose(s)}
                  style={{ flexGrow: s.duration }}
                >
                  <div>
                    {a?.kind === "image" ? (
                      <img src={assetUrl(a.id)} alt="" />
                    ) : (
                      <FilmStrip size={22} />
                    )}
                    <span>{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <small>{s.duration}s</small>
                </button>
              );
            })}
            {!draft.shots.length && (
              <span className="timeline-empty">
                Your scenes will appear here.
              </span>
            )}
          </div>
          {activeJobs.length > 0 && (
            <div className="job-strip">
              {activeJobs.map((j) => (
                <div key={j.id}>
                  <CircleNotch
                    className={j.state === "unknown" ? "" : "spin"}
                    size={15}
                  />
                  <span>
                    {j.kind === "generate"
                      ? "Generating a take"
                      : j.kind === "render"
                        ? "Rendering your film"
                        : j.kind === "plan"
                          ? "Directing a storyboard"
                          : "Recording narration"}
                    :{" "}
                    {j.state === "unknown"
                      ? "check provider status"
                      : `${Math.round(j.progress)}%`}
                  </span>
                  {j.state === "unknown" ? (
                    <button onClick={() => setTab("export")}>Resolve</button>
                  ) : (
                    <button
                      onClick={() =>
                        action("cancel", () =>
                          api(`/jobs/${j.id}/cancel`, { method: "POST" }),
                        )
                      }
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
        <aside className="inspector">
          <div
            className="inspector-tabs"
            role="tablist"
            aria-label="Editing tools"
          >
            {(
              [
                "scene",
                "generate",
                "audio",
                "brand",
                "export",
              ] as InspectorTab[]
            ).map((t) => (
              <button
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? "active" : ""}
                key={t}
                onClick={() => setTab(t)}
              >
                {t === "brand" ? "Brief" : t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="inspector-content">
            {tab === "scene" &&
              (shot ? (
                <>
                  <div className="inspector-heading">
                    <h2>{shot.title}</h2>
                    <button
                      className="icon-button"
                      aria-label="Delete selected scene"
                      onClick={() =>
                        mutate((d) => {
                          d.shots = d.shots.filter((s) => s.id !== shot.id);
                        })
                      }
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                  <label>
                    Scene name
                    <input
                      value={shot.title}
                      onChange={(e) => editShot({ title: e.target.value })}
                    />
                  </label>
                  <label>
                    On-screen caption
                    <textarea
                      rows={2}
                      maxLength={140}
                      value={shot.caption}
                      onChange={(e) => editShot({ caption: e.target.value })}
                    />
                  </label>
                  <label>
                    Source
                    <select
                      value={shot.assetId || ""}
                      onChange={(e) =>
                        editShot({
                          assetId: e.target.value || null,
                          selectedTakeId: null,
                        })
                      }
                    >
                      <option value="">No source</option>
                      {sceneAssets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.metadata.state || a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="field-pair">
                    <label>
                      Duration (seconds)
                      <input
                        type="number"
                        min={1}
                        max={20}
                        step={0.5}
                        value={shot.duration}
                        onChange={(e) =>
                          editShot({
                            duration: Math.min(
                              20,
                              Math.max(1, Number(e.target.value) || 1),
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Layout
                      <select
                        value={shot.template}
                        onChange={(e) =>
                          editShot({
                            template: e.target.value as Shot["template"],
                          })
                        }
                      >
                        {[
                          "reveal",
                          "showcase",
                          "closeup",
                          "comparison",
                          "atmosphere",
                          "endcard",
                        ].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {shot.template === "comparison" && (
                    <label>
                      Comparison source
                      <select
                        value={shot.secondaryAssetId || ""}
                        onChange={(e) =>
                          editShot({ secondaryAssetId: e.target.value || null })
                        }
                      >
                        <option value="">Choose another screen</option>
                        {sceneAssets.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="field-pair">
                    <label>
                      Movement
                      <select
                        value={shot.motion}
                        onChange={(e) =>
                          editShot({ motion: e.target.value as Shot["motion"] })
                        }
                      >
                        {["push", "pull", "pan", "float", "still"].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Transition
                      <select
                        value={shot.transition}
                        onChange={(e) =>
                          editShot({
                            transition: e.target.value as Shot["transition"],
                          })
                        }
                      >
                        <option value="fade">Fade</option>
                        <option value="cut">Cut</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    Rendering mode
                    <select
                      value={shot.mode}
                      onChange={(e) =>
                        editShot({ mode: e.target.value as Shot["mode"] })
                      }
                    >
                      <option value="exact-ui">Exact UI</option>
                      <option value="generated-video">Generated video</option>
                      <option value="hybrid">
                        Hybrid: UI + generated background
                      </option>
                    </select>
                  </label>
                  <p className="field-help">
                    Exact UI keeps your source intact. Generated and hybrid
                    scenes need a selected take before export.
                  </p>
                  <details className="disclosure">
                    <summary>Framing & trim</summary>
                    <label>
                      Crop width{" "}
                      <span>{Math.round(shot.focalRect.width * 100)}%</span>
                      <input
                        type="range"
                        min={0.2}
                        max={1}
                        step={0.01}
                        value={shot.focalRect.width}
                        onChange={(e) => {
                          const width = +e.target.value;
                          editShot({
                            focalRect: {
                              ...shot.focalRect,
                              width,
                              x: Math.min(shot.focalRect.x, 1 - width),
                            },
                          });
                        }}
                      />
                    </label>
                    <label>
                      Crop height{" "}
                      <span>{Math.round(shot.focalRect.height * 100)}%</span>
                      <input
                        type="range"
                        min={0.2}
                        max={1}
                        step={0.01}
                        value={shot.focalRect.height}
                        onChange={(e) => {
                          const height = +e.target.value;
                          editShot({
                            focalRect: {
                              ...shot.focalRect,
                              height,
                              y: Math.min(shot.focalRect.y, 1 - height),
                            },
                          });
                        }}
                      />
                    </label>
                    <label>
                      Horizontal position
                      <input
                        type="range"
                        min={0}
                        max={1 - shot.focalRect.width}
                        step={0.01}
                        value={shot.focalRect.x}
                        onChange={(e) =>
                          editShot({
                            focalRect: {
                              ...shot.focalRect,
                              x: +e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      Vertical position
                      <input
                        type="range"
                        min={0}
                        max={1 - shot.focalRect.height}
                        step={0.01}
                        value={shot.focalRect.y}
                        onChange={(e) =>
                          editShot({
                            focalRect: {
                              ...shot.focalRect,
                              y: +e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      Video start (seconds)
                      <input
                        type="number"
                        min={0}
                        max={600}
                        step={0.1}
                        value={shot.trimStart}
                        onChange={(e) =>
                          editShot({ trimStart: Math.max(0, +e.target.value) })
                        }
                      />
                    </label>
                    <label>
                      Scene background
                      <input
                        type="color"
                        value={shot.background}
                        onChange={(e) =>
                          editShot({ background: e.target.value })
                        }
                      />
                    </label>
                  </details>
                </>
              ) : (
                <div className="panel-empty">
                  <p>Select or add a scene to start directing.</p>
                </div>
              ))}
            {tab === "generate" &&
              (shot ? (
                <>
                  <h2>Give this scene movement.</h2>
                  <p className="field-help">
                    Each generation becomes a new take. Your source stays
                    untouched.
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
                    <textarea
                      rows={5}
                      value={shot.prompt}
                      maxLength={1000}
                      onChange={(e) => editShot({ prompt: e.target.value })}
                    />
                  </label>
                  <label>
                    Model
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    >
                      <option value="gen4_turbo">Gen-4 Turbo</option>
                      <option value="gen4.5">Gen-4.5</option>
                    </select>
                  </label>
                  <label>
                    Generated length
                    <select
                      value={seconds}
                      onChange={(e) => setSeconds(+e.target.value)}
                    >
                      <option value={5}>5 seconds</option>
                      <option value={10}>10 seconds</option>
                    </select>
                  </label>
                  <div className="cost-summary">
                    <span>Estimated generation</span>
                    <strong>
                      {money((model === "gen4_turbo" ? 5 : 12) * seconds)}
                    </strong>
                  </div>
                  <button
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
                            maxCostCents:
                              (model === "gen4_turbo" ? 5 : 12) * seconds,
                          }),
                        );
                        setNotice("Generation queued. You can keep editing.");
                      })
                    }
                  >
                    <Sparkle size={17} />
                    Generate take
                  </button>
                  <h3 className="subsection-title">Your takes</h3>
                  {selectedTakes.length ? (
                    selectedTakes.map((t) => (
                      <article className="take-card" key={t.id}>
                        <video
                          src={assetUrl(t.assetId)}
                          controls
                          preload="metadata"
                        />
                        <div>
                          <span>{t.model}</span>
                          <button
                            className="button secondary small"
                            onClick={() =>
                              editShot({
                                selectedTakeId: t.id,
                                mode:
                                  shot.mode === "exact-ui"
                                    ? "generated-video"
                                    : shot.mode,
                              })
                            }
                          >
                            {shot.selectedTakeId === t.id ? (
                              <>
                                <Check size={13} />
                                Selected
                              </>
                            ) : (
                              "Use this take"
                            )}
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="muted small-copy">
                      Your generated takes will appear here for comparison.
                    </p>
                  )}
                </>
              ) : (
                <p>Select a scene first.</p>
              ))}
            {tab === "audio" && (
              <>
                <h2>A voice for the story.</h2>
                {shot && (
                  <>
                    <label>
                      Scene narration
                      <textarea
                        rows={4}
                        value={shot.narration}
                        onChange={(e) =>
                          editShot({ narration: e.target.value })
                        }
                        maxLength={1200}
                      />
                    </label>
                    <label>
                      Narration recording
                      <select
                        value={shot.narrationAssetId || ""}
                        onChange={(e) =>
                          editShot({ narrationAssetId: e.target.value || null })
                        }
                      >
                        <option value="">No narration</option>
                        {audioAssets.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {shot.narrationAssetId && (
                      <>
                        <audio
                          className="audio-preview"
                          controls
                          src={assetUrl(shot.narrationAssetId)}
                        />
                        {(audioAssets.find(
                          (a) => a.id === shot.narrationAssetId,
                        )?.duration || 0) > shot.duration && (
                          <div>
                            <p className="error">
                              This recording is longer than the scene.
                            </p>
                            {(audioAssets.find(
                              (a) => a.id === shot.narrationAssetId,
                            )?.duration || 0) <= 20 && (
                              <button
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
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                    <details className="disclosure">
                      <summary>Generate a voice-over</summary>
                      {!connected("elevenlabs") && (
                        <Link
                          href="/settings"
                          onClick={(e) => leave(e, "/settings")}
                          className="connection-note"
                        >
                          Connect ElevenLabs ↗
                        </Link>
                      )}
                      <label>
                        ElevenLabs voice ID
                        <input
                          value={voice}
                          onChange={(e) => setVoice(e.target.value)}
                          placeholder="Your selected stock voice ID"
                        />
                      </label>
                      <p className="field-help">
                        Estimated maximum{" "}
                        {money(
                          Math.max(5, Math.ceil(shot.narration.length * 0.04)),
                        )}
                        . Uses your provider account.
                      </p>
                      <button
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
                      </button>
                    </details>
                  </>
                )}
                <div className="inspector-divider" />
                <h3>Film soundtrack</h3>
                <label>
                  Music
                  <select
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
                  </select>
                </label>
                <label>
                  Music level{" "}
                  <span>{Math.round(draft.musicVolume * 100)}%</span>
                  <input
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
                  Music lowers under narration. Import music you have permission
                  to use.
                </p>
                <button
                  className="button secondary wide"
                  onClick={() => input.current?.click()}
                >
                  <MusicNotes size={16} />
                  Import audio
                </button>
                {snap.jobs
                  .filter(
                    (j) =>
                      j.kind === "narrate" &&
                      j.state === "completed" &&
                      j.outputAssetId,
                  )
                  .map((j) => (
                    <div className="audio-result" key={j.id}>
                      <audio controls src={assetUrl(j.outputAssetId!)} />
                      <button
                        className="text-link"
                        onClick={() =>
                          editShot({ narrationAssetId: j.outputAssetId })
                        }
                      >
                        Use in selected scene
                      </button>
                    </div>
                  ))}
              </>
            )}
            {tab === "brand" && (
              <>
                <h2>The film brief.</h2>
                <label>
                  What does your product do?
                  <textarea
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
                  <textarea
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
                  <input
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
                  <select
                    value={draft.treatment}
                    onChange={(e) =>
                      mutate((d) => {
                        d.treatment = e.target.value as Draft["treatment"];
                      })
                    }
                  >
                    <option value="editorial">Editorial / deliberate</option>
                    <option value="energetic">Energetic / quick cuts</option>
                    <option value="minimal">
                      Minimal / let the product speak
                    </option>
                  </select>
                </label>
                <button
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
                        d.shots.forEach(
                          (s) => (s.background = palette.background),
                        );
                      });
                    })
                  }
                >
                  Use captured website colors
                </button>
                <div className="field-pair">
                  <label>
                    Accent
                    <input
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
                    <input
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
                  <input
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
                  <select
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
                  </select>
                </label>
                <label>
                  Logo
                  <select
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
                  </select>
                </label>
                <button
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
                </button>
                <div className="inspector-divider" />
                <h3>Ask the director.</h3>
                <p className="field-help">
                  Gemini reads your selected screens and brief. Review its
                  proposal before applying it. Reserve: $0.25.
                </p>
                {!connected("gemini") && (
                  <Link
                    className="connection-note"
                    href="/settings"
                    onClick={(e) => leave(e, "/settings")}
                  >
                    Connect Gemini ↗
                  </Link>
                )}
                <button
                  className="button wide"
                  disabled={
                    !connected("gemini") || !sceneAssets.length || !!busy
                  }
                  onClick={() =>
                    action("plan", async () => {
                      const revision = await savedRevision();
                      await api(
                        `/projects/${id}/plan`,
                        jobOptions({ revision }),
                      );
                      setNotice("The director is preparing a proposal.");
                    })
                  }
                >
                  <Sparkle size={16} />
                  Propose a storyboard
                </button>
                {proposals.map((j) => (
                  <button
                    key={j.id}
                    className="proposal-link"
                    onClick={() => setShowProposal(j.id)}
                  >
                    Review {j.payload.result.shots.length}-scene proposal{" "}
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </>
            )}
            {tab === "export" && (
              <>
                <h2>Ready for its audience.</h2>
                <div className="export-spec">
                  <span>
                    {dimensions(draft.format).width} ×{" "}
                    {dimensions(draft.format).height}
                  </span>
                  <span>MP4 / 30 fps</span>
                  <span>{total.toFixed(1)} seconds</span>
                </div>
                <p className="field-help">
                  Review every scene at normal speed. Export uses the original
                  captures and your selected takes.
                </p>
                <button
                  className="button wide"
                  disabled={!!busy || !draft.shots.length}
                  onClick={() =>
                    action("render", async () => {
                      const revision = await savedRevision();
                      await api(
                        `/projects/${id}/render`,
                        jobOptions({ revision }),
                      );
                      setNotice(
                        "Rendering in the background. Your download will appear here.",
                      );
                    })
                  }
                >
                  <DownloadSimple size={17} />
                  Render film
                </button>
                <h3 className="subsection-title">Finished exports</h3>
                {exports.length ? (
                  exports.map((a) => (
                    <article className="export-card" key={a.id}>
                      <video src={assetUrl(a.id)} controls preload="metadata" />
                      <a
                        className="button secondary small wide"
                        href={`${assetUrl(a.id)}?download`}
                        download
                      >
                        <DownloadSimple size={14} />
                        Download MP4
                      </a>
                      <small>{new Date(a.createdAt).toLocaleString()}</small>
                    </article>
                  ))
                ) : (
                  <p className="muted small-copy">
                    Completed films appear here. Local rendering has no AI
                    charge.
                  </p>
                )}
                <div className="download-links">
                  {snap.assets
                    .filter((a) => a.metadata.state === "export-poster")
                    .slice(-1)
                    .map((a) => (
                      <a
                        key={a.id}
                        href={`${assetUrl(a.id)}?download`}
                        download
                      >
                        Poster frame (.png) <DownloadSimple size={15} />
                      </a>
                    ))}
                  <a href={`/api/projects/${id}/captions`} download>
                    Scene captions (.srt) <DownloadSimple size={15} />
                  </a>
                  <a href={`/api/projects/${id}/archive`} download>
                    Project archive (.zip) <DownloadSimple size={15} />
                  </a>
                </div>
                <details className="disclosure">
                  <summary>Spending & history</summary>
                  <div className="cost-summary">
                    <span>Estimated charges</span>
                    <strong>{money(snap.budget.spent)}</strong>
                  </div>
                  <div className="cost-summary">
                    <span>Reserved</span>
                    <strong>{money(snap.budget.reserved)}</strong>
                  </div>
                  <label>
                    Project limit (USD)
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={draft.budgetCents / 100}
                      onChange={(e) =>
                        mutate((d) => {
                          d.budgetCents = Math.round(+e.target.value * 100);
                        })
                      }
                    />
                  </label>
                  <p className="field-help">
                    Provider billing is authoritative. Uncertain submissions
                    keep their reservation until reconciled.
                  </p>
                  {snap.revisions.slice(0, 12).map((r) => (
                    <button
                      className="revision-row"
                      key={r.revision}
                      disabled={!!busy}
                      onClick={() =>
                        action("restore", async () => {
                          const revision = await savedRevision();
                          await api(`/projects/${id}/restore`, {
                            method: "POST",
                            body: JSON.stringify({
                              revision,
                              target: r.revision,
                            }),
                          });
                        })
                      }
                    >
                      <span>{r.label}</span>
                      <small>r{r.revision}</small>
                    </button>
                  ))}
                </details>
                <h3 className="subsection-title">Job history</h3>
                {snap.jobs.slice(0, 12).map((j) => (
                  <article
                    className={`history-job ${j.state === "failed" || j.state === "unknown" ? "has-error" : ""}`}
                    key={j.id}
                  >
                    <div>
                      <strong>{j.kind}</strong>
                      <span>{j.state}</span>
                    </div>
                    {j.error && <p>{j.error}</p>}
                    {j.state === "unknown" && (
                      <>
                        <p>
                          Check the provider dashboard first. Was this request
                          charged?
                        </p>
                        <div className="reconcile-actions">
                          {(["charged", "not-submitted"] as const).map(
                            (outcome) => (
                              <button
                                key={outcome}
                                disabled={!!busy}
                                onClick={() =>
                                  action("reconcile", () =>
                                    api(`/jobs/${j.id}/reconcile`, {
                                      method: "POST",
                                      body: JSON.stringify({
                                        outcome,
                                        checkedProvider: true,
                                      }),
                                    }),
                                  )
                                }
                              >
                                {outcome === "charged"
                                  ? "Confirmed charged"
                                  : "Confirmed not submitted"}
                              </button>
                            ),
                          )}
                        </div>
                      </>
                    )}
                  </article>
                ))}
              </>
            )}
          </div>
        </aside>
      </div>
      {captureOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCaptureOpen(false);
          }}
        >
          <section
            className="modal capture-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="capture-title"
          >
            <button
              className="icon-button close-modal"
              aria-label="Close capture dialog"
              onClick={() => setCaptureOpen(false)}
            >
              <X size={20} />
            </button>
            <p className="eyebrow">Real screens, ready to direct</p>
            <h2 id="capture-title">Bring your product in.</h2>
            <div className="capture-options">
              <article>
                <LinkSimple size={27} />
                <h3>Capture a website</h3>
                <p>
                  Use the Chrome extension in a tab where you’re already signed
                  in.
                </p>
                <a
                  href="/downloads/cue-capture.zip"
                  download
                  className="text-link"
                >
                  Download extension <DownloadSimple size={16} />
                </a>
                <Link href="/guide" className="text-link" target="_blank">
                  Setup instructions <ArrowUpRight size={16} />
                </Link>
                <button
                  className="button secondary"
                  disabled={!!busy}
                  onClick={() =>
                    action("pair", async () =>
                      setPairing(
                        await api(`/projects/${id}/pairing`, {
                          method: "POST",
                        }),
                      ),
                    )
                  }
                >
                  Generate pairing code
                </button>
                {pairing && (
                  <div className="pairing-code">
                    <code>{pairing.code}</code>
                    <button
                      className="icon-button"
                      aria-label="Copy pairing code"
                      onClick={() => {
                        navigator.clipboard.writeText(pairing.code);
                        setNotice("Pairing code copied.");
                      }}
                    >
                      <Copy size={16} />
                    </button>
                    <small>
                      Paste into Cue Capture. Expires in 10 minutes.
                    </small>
                  </div>
                )}
              </article>
              <article>
                <UploadSimple size={27} />
                <h3>Import your media</h3>
                <p>
                  Screenshots, product recordings, a logo or your soundtrack.
                </p>
                <button
                  className="button"
                  disabled={!!busy}
                  onClick={() => input.current?.click()}
                >
                  {busy === "upload" ? "Importing…" : "Choose files"}
                  <Plus size={16} />
                </button>
                <small>
                  Images, MP4, WebM and audio.
                  <br />
                  Up to 64 MiB per file.
                </small>
              </article>
            </div>
          </section>
        </div>
      )}
      {showProposal && (
        <div className="modal-backdrop">
          <section
            className="modal proposal-modal"
            role="dialog"
            aria-modal="true"
            aria-label="AI storyboard proposal"
          >
            <button
              className="icon-button close-modal"
              aria-label="Close proposal"
              onClick={() => setShowProposal(null)}
            >
              <X size={20} />
            </button>
            <h2>A proposed direction.</h2>
            <p>
              Check every product claim against the source screens. Review these
              scenes before replacing your timeline. Your current version stays
              in history.
            </p>
            {proposals
              .find((j) => j.id === showProposal)
              ?.payload.result.shots.map((s: Shot, i: number) => (
                <article className="proposal-scene" key={i}>
                  <span>{i + 1}</span>
                  <div>
                    <strong>{s.title}</strong>
                    <p>{s.caption}</p>
                    <small>
                      {s.duration}s / {s.mode}
                    </small>
                    <p>{s.purpose}</p>
                    <small>
                      Evidence:{" "}
                      {s.evidenceIds
                        .map(
                          (id) =>
                            snap.assets.find((a) => a.id === id)?.name || id,
                        )
                        .join(", ")}
                    </small>
                  </div>
                </article>
              ))}
            <button
              className="button"
              disabled={!!busy}
              onClick={() =>
                action("apply", async () => {
                  const revision = await savedRevision();
                  await api(`/projects/${id}/apply-plan`, {
                    method: "POST",
                    body: JSON.stringify({ revision, jobId: showProposal }),
                  });
                  setShowProposal(null);
                })
              }
            >
              Use this storyboard <Check size={17} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
