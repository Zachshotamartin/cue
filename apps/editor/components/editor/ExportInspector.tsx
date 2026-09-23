"use client";
import { DownloadSimple } from "@phosphor-icons/react";
import { dimensions } from "../../../../packages/contracts";
import { api, assetUrl, jobOptions, money } from "../client-api";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useEditor } from "./EditorContext";
import { Disclosure } from "../ui/Disclosure";
import { ExportCard } from "./ExportCard";

export function ExportInspector() {
  const {
    id,
    snap,
    draft,
    tab,
    setNotice,
    busy,
    mutate,
    action,
    savedRevision,
    exports,
    total,
  } = useEditor();
  return (
    <>
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
          <Button
            className="button wide"
            disabled={!!busy || !draft.shots.length}
            onClick={() =>
              action("render", async () => {
                const revision = await savedRevision();
                await api(`/projects/${id}/render`, jobOptions({ revision }));
                setNotice(
                  "Rendering in the background. Your download will appear here.",
                );
              })
            }
          >
            <DownloadSimple size={17} />
            Render film
          </Button>
          <h3 className="subsection-title">Finished exports</h3>
          {exports.length ? (
            exports.map((a) => <ExportCard key={a.id || "item"} a={a} />)
          ) : (
            <p className="muted small-copy">
              Completed films appear here. Local rendering has no AI charge.
            </p>
          )}
          <div className="download-links">
            {snap.assets
              .filter((a) => a.metadata.state === "export-poster")
              .slice(-1)
              .map((a) => (
                <a key={a.id} href={`${assetUrl(a.id)}?download`} download>
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
          <Disclosure title="Spending & history">
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
              <Input
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
              Provider billing is authoritative. Uncertain submissions keep
              their reservation until reconciled.
            </p>
            {snap.revisions.slice(0, 12).map((r) => (
              <Button
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
              </Button>
            ))}
          </Disclosure>
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
                    {(["charged", "not-submitted"] as const).map((outcome) => (
                      <Button
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
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </article>
          ))}
        </>
      )}
    </>
  );
}
