"use client";
import { CircleNotch } from "@phosphor-icons/react";
import { api } from "../client-api";
import { Button } from "../ui/Button";
import { useEditor } from "./EditorContext";

export function JobActivity() {
  const { setTab, action, activeJobs } = useEditor();
  return (
    <>
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
              <Button onClick={() => setTab("export")}>Resolve</Button>
            ) : (
              <Button
                onClick={() =>
                  action("cancel", () =>
                    api(`/jobs/${j.id}/cancel`, { method: "POST" }),
                  )
                }
              >
                Cancel
              </Button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
