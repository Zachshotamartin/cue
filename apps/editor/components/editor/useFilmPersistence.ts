"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  draftSchema,
  type Draft,
  type Project,
  type Snapshot,
} from "../../../../packages/contracts";
import { api } from "../client-api";
function clearRecovery(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* Cloud saves remain authoritative when browser storage is unavailable. */
  }
}

/** Autosave, multi-tab conflicts, undo and local recovery share one revision authority. */
export function useFilmPersistence(
  id: string,
  setError: (message: string) => void,
) {
  const [snap, setSnap] = useState<Snapshot | null>(null),
    [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false),
    dirtyRef = useRef(false),
    history = useRef<Draft[]>([]),
    future = useRef<Draft[]>([]);
  const [saveState, setSaveState] = useState("Saved"),
    [conflict, setConflict] = useState(false);
  const [recovery, setRecovery] = useState<{
    draft: Draft;
    revision: number;
  } | null>(null);
  const baseRevision = useRef(0),
    ownerRef = useRef(""),
    saveFlight = useRef<Promise<Project | undefined> | null>(null),
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
    // A poll started before a save can arrive after its response. Never
    // replace the acknowledged draft/revision with that older snapshot.
    if (data.project.revision < baseRevision.current) return;
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
          const parsed = draftSchema.safeParse(r.draft);
          if (
            parsed.success &&
            JSON.stringify(r.draft) !== JSON.stringify(data.project.draft)
          )
            setRecovery({
              draft: parsed.data,
              revision: Number(r.revision) || data.project.revision,
            });
          else clearRecovery(recoveryKey());
        }
      } catch {}
    }
  }, [id]);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
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
  async function save(): Promise<Project | undefined> {
    if (saveFlight.current) return saveFlight.current;
    if (conflictRef.current)
      throw new Error("Resolve the save conflict before continuing.");
    if (!draftRef.current || !baseRevision.current) return;
    const operation = (async () => {
      let result: Project | undefined;
      while (dirtyRef.current) {
        const value = draftRef.current!;
        setSaveState("Saving…");
        preserve(value);
        try {
          const r = await api<{ project: Project }>(`/projects/${id}/edits`, {
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
  async function savedRevision() {
    if (dirtyRef.current) {
      const p = await save();
      return p?.revision;
    }
    return baseRevision.current || undefined;
  }
  return {
    snap,
    setSnap,
    draft,
    setDraft,
    dirty,
    setDirty,
    dirtyRef,
    history,
    future,
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
    savedRevision,
  };
}
