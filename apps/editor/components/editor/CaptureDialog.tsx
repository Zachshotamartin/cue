"use client";
import {
  ArrowUpRight,
  Copy,
  DownloadSimple,
  LinkSimple,
  Plus,
  UploadSimple,
} from "@phosphor-icons/react";
import Link from "next/link";
import { api } from "../client-api";
import { Button } from "../ui/Button";
import { useEditor } from "./EditorContext";
import { CapturePlan } from "./CapturePlan";
import { Modal } from "../ui/Modal";

export function CaptureDialog() {
  const {
    id,
    setNotice,
    busy,
    pairing,
    setPairing,
    setCaptureOpen,
    input,
    action,
  } = useEditor();
  return (
    <>
      <Modal
        className="capture-modal"
        labelledBy="capture-title"
        onClose={() => setCaptureOpen(false)}
      >
        <p className="eyebrow">Real screens, ready to direct</p>
        <h2 id="capture-title">Bring your product in.</h2>
        <CapturePlan />
        <div className="capture-options">
          <article>
            <LinkSimple size={27} />
            <h3>Capture a website</h3>
            <p>
              Use the Chrome extension in a tab where you’re already signed in.
            </p>
            <a href="/downloads/cue-capture.zip" download className="text-link">
              Download extension <DownloadSimple size={16} />
            </a>
            <Link href="/guide" className="text-link" target="_blank">
              Setup instructions <ArrowUpRight size={16} />
            </Link>
            <Button
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
            </Button>
            {pairing && (
              <div className="pairing-code">
                <code>{pairing.code}</code>
                <Button
                  className="icon-button"
                  aria-label="Copy pairing code"
                  onClick={() => {
                    navigator.clipboard.writeText(pairing.code);
                    setNotice("Pairing code copied.");
                  }}
                >
                  <Copy size={16} />
                </Button>
                <small>Paste into Cue Capture. Expires in 10 minutes.</small>
              </div>
            )}
          </article>
          <article>
            <UploadSimple size={27} />
            <h3>Import your media</h3>
            <p>Screenshots, product recordings, a logo or your soundtrack.</p>
            <Button
              className="button"
              disabled={!!busy}
              onClick={() => input.current?.click()}
            >
              {busy === "upload" ? "Importing…" : "Choose files"}
              <Plus size={16} />
            </Button>
            <small>
              Images, MP4, WebM and audio.
              <br />
              Up to 64 MiB per file.
            </small>
          </article>
        </div>
      </Modal>
    </>
  );
}
