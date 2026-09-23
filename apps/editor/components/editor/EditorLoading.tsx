"use client";
import Link from "next/link";

import { Logo } from "../Logo";

export function EditorLoading({ error }: { error: string }) {
  return (
    <div className="editor-loading">
      <Logo />
      <p>{error || "Opening your film…"}</p>
      <Link href="/projects">Back to studio</Link>
    </div>
  );
}
