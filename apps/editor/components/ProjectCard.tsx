"use client";
import { ArrowUpRight, FilmStrip } from "@phosphor-icons/react";
import Link from "next/link";
import type { Project } from "../../../packages/contracts";
import { api, assetUrl } from "./client-api";
import { Button } from "./ui/Button";
export type LibraryProject = Project & {
  thumbnail?: string;
  assetCount: number;
  archived?: boolean;
};
export function ProjectCard({
  p,
  onArchive,
  setError,
}: {
  p: LibraryProject;
  onArchive: (id: string, archived: boolean) => void;
  setError: (error: string) => void;
}) {
  return (
    <article key={p.id}>
      <Link className="project-card" href={`/projects/${p.id}`} key={p.id}>
        <div className="project-image">
          {p.thumbnail ? (
            <img
              src={assetUrl(p.thumbnail)}
              alt={`${p.draft.title} source preview`}
            />
          ) : (
            <div className="project-placeholder">
              <FilmStrip size={56} weight="thin" />
              <span>Your next opening frame.</span>
            </div>
          )}
          <span className="project-arrow">
            <ArrowUpRight size={23} />
          </span>
        </div>
        <div className="project-info">
          <h2>{p.draft.title}</h2>
          <span>
            {p.draft.shots.length} scenes · {p.assetCount} assets
          </span>
        </div>
        <p>{p.draft.siteUrl || "Independent film project"}</p>
      </Link>
      <div className="project-actions">
        <span>{new Date(p.updatedAt).toLocaleDateString()}</span>
        <Button
          className="text-link"
          onClick={async () => {
            try {
              await api(
                `/projects/${p.id}/${p.archived ? "unarchive" : "archive"}`,
                { method: "POST" },
              );
              onArchive(p.id, !p.archived);
            } catch (e: any) {
              setError(e.message);
            }
          }}
        >
          {p.archived ? "Restore" : "Archive"}
        </Button>
      </div>
    </article>
  );
}
