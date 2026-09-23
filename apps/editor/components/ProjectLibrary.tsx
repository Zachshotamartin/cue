"use client";
import { ArrowRight, FilmStrip, Plus } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Project } from "../../../packages/contracts";
import { api } from "./client-api";
import { Button } from "./ui/Button";
import { CreateFilmDialog } from "./CreateFilmDialog";
import { ProjectCard } from "./ProjectCard";
export function ProjectLibrary() {
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const [projects, setProjects] = useState<
      (Project & {
        thumbnail?: string;
        assetCount: number;
        archived?: boolean;
      })[]
    >([]),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [creating, setCreating] = useState(false),
    [pending, setPending] = useState(false);

  useEffect(() => {
    api("/projects")
      .then((x) => setProjects(x.projects))
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);
  async function create(form: FormData) {
    setPending(true);
    setError("");
    try {
      const x = await api("/projects", {
        method: "POST",
        body: JSON.stringify({
          title: String(form.get("title")),
          siteUrl: String(form.get("url") || ""),
        }),
      });
      router.push(`/projects/${x.project.id}`);
    } catch (e: any) {
      setError(e.message);
      setPending(false);
    }
  }
  return (
    <main className="library page-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Your studio</p>
          <h1>Your films. In the making.</h1>
          <p>Real screens, a little direction, a story of your own.</p>
        </div>
        <Button className="button" onClick={() => setCreating(true)}>
          <Plus size={18} /> New film
        </Button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="library-filter">
        <Button
          className="text-link"
          aria-pressed={!showArchived}
          onClick={() => setShowArchived(false)}
        >
          Recent films
        </Button>
        <Button
          className="text-link"
          aria-pressed={showArchived}
          onClick={() => setShowArchived(true)}
        >
          Archived
        </Button>
      </div>
      {!loaded ? (
        <div className="loading-layout" aria-label="Loading films">
          <div />
          <div />
          <div />
        </div>
      ) : projects.filter((p) => !!p.archived === showArchived).length ? (
        <div className="project-grid">
          {projects
            .filter((p) => !!p.archived === showArchived)
            .map((p) => (
              <ProjectCard
                key={p.id}
                p={p}
                setError={setError}
                onArchive={(id, archived) =>
                  setProjects((list) =>
                    list.map((x) => (x.id === id ? { ...x, archived } : x)),
                  )
                }
              />
            ))}
        </div>
      ) : (
        <div className="empty-library">
          <div>
            <FilmStrip size={48} weight="thin" />
            <h2>
              A blank timeline.
              <br />A lot of possibility.
            </h2>
            <p>
              Create your first film, then capture a website or import a few
              screens.
            </p>
            <Button className="text-link" onClick={() => setCreating(true)}>
              Create a film <ArrowRight size={18} />
            </Button>
          </div>
          <img
            src="/brand/frames.png"
            alt="Three glass frames waiting to become a story"
          />
        </div>
      )}
      {creating && (
        <CreateFilmDialog
          error={error}
          pending={pending}
          create={create}
          onClose={() => setCreating(false)}
        />
      )}
    </main>
  );
}
