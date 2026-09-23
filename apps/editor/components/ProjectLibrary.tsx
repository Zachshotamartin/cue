"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  Plus,
  X,
  FilmStrip,
  ArrowRight,
} from "@phosphor-icons/react";
import { api, assetUrl } from "./client-api";
import { useModalFocus } from "./useModalFocus";
import type { Project } from "../../../packages/contracts";
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
  useModalFocus(creating, () => setCreating(false));
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
          <h1>Good things in the making.</h1>
          <p>Pick up a film, or give something new its first cue.</p>
        </div>
        <button className="button" onClick={() => setCreating(true)}>
          <Plus size={18} /> New film
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="library-filter">
        <button
          className="text-link"
          aria-pressed={!showArchived}
          onClick={() => setShowArchived(false)}
        >
          Recent films
        </button>
        <button
          className="text-link"
          aria-pressed={showArchived}
          onClick={() => setShowArchived(true)}
        >
          Archived
        </button>
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
              <article key={p.id}>
                <Link
                  className="project-card"
                  href={`/projects/${p.id}`}
                  key={p.id}
                >
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
                  <button
                    className="text-link"
                    onClick={async () => {
                      try {
                        await api(
                          `/projects/${p.id}/${p.archived ? "unarchive" : "archive"}`,
                          { method: "POST" },
                        );
                        setProjects((list) =>
                          list.map((x) =>
                            x.id === p.id ? { ...x, archived: !p.archived } : x,
                          ),
                        );
                      } catch (e: any) {
                        setError(e.message);
                      }
                    }}
                  >
                    {p.archived ? "Restore" : "Archive"}
                  </button>
                </div>
              </article>
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
            <button className="text-link" onClick={() => setCreating(true)}>
              Create a film <ArrowRight size={18} />
            </button>
          </div>
          <img
            src="/brand/frames.png"
            alt="Three glass frames waiting to become a story"
          />
        </div>
      )}
      {creating && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCreating(false);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-title"
          >
            <button
              className="icon-button close-modal"
              aria-label="Close"
              onClick={() => setCreating(false)}
            >
              <X size={20} />
            </button>
            <p className="eyebrow">A new beginning</p>
            <h2 id="create-title">What are we introducing?</h2>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <form action={create}>
              <label>
                Film name
                <input
                  name="title"
                  placeholder="My product launch"
                  required
                  autoFocus
                  maxLength={100}
                />
              </label>
              <label>
                Website <span className="optional">optional</span>
                <input
                  name="url"
                  type="url"
                  placeholder="https://your-product.com"
                />
              </label>
              <p className="form-note">
                Signed-in pages work through the capture extension. You can also
                import screenshots and recordings.
              </p>
              <button className="button" disabled={pending}>
                {pending ? "Creating…" : "Create film"}
                <ArrowRight size={18} />
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
