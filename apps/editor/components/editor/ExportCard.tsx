"use client";

import { DownloadSimple } from "@phosphor-icons/react";

import { assetUrl } from "../client-api";
import { useEditor } from "./EditorContext";
import type { Asset } from "../../../../packages/contracts";
export function ExportCard({ a }: { a: Asset }) {
  const {} = useEditor();
  return (
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
  );
}
