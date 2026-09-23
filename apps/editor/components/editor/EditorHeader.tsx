"use client";
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowLeft,
  DownloadSimple,
  GearSix,
} from "@phosphor-icons/react";
import Link from "next/link";
import { Logo } from "../Logo";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useEditor } from "./EditorContext";

export function EditorHeader() {
  const {
    draft,
    setTab,
    dirty,
    busy,
    history,
    future,
    saveState,
    mutate,
    undo,
    save,
    action,
    leave,
  } = useEditor();
  return (
    <>
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
          <Input
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
          <Button
            className="icon-button"
            aria-label="Undo edit"
            disabled={!history.current.length}
            onClick={() => undo()}
          >
            <ArrowCounterClockwise size={18} />
          </Button>
          <Button
            className="icon-button"
            aria-label="Redo edit"
            disabled={!future.current.length}
            onClick={() => undo(true)}
          >
            <ArrowClockwise size={18} />
          </Button>
          <Link
            href="/settings"
            onClick={(e) => leave(e, "/settings")}
            className="icon-button"
            aria-label="Provider settings"
          >
            <GearSix size={19} />
          </Link>
          <Button
            className="button secondary small"
            disabled={!dirty || !!busy}
            onClick={() => action("save", save)}
          >
            {busy === "save" ? "Saving…" : "Save"}
          </Button>
          <Button className="button small" onClick={() => setTab("export")}>
            <DownloadSimple size={16} />
            Export
          </Button>
        </div>
      </header>
    </>
  );
}
