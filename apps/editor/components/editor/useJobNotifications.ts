"use client";
import { useEffect, useRef } from "react";
import type { Job } from "../../../../packages/contracts";
const completed: Record<Job["kind"], string> = {
  render: "Your film is ready. Open Export to watch or download it.",
  generate: "A new take is ready in Generate.",
  plan: "Your storyboard proposal is ready in Brief.",
  analyze: "Capture analysis is ready for your storyboard.",
  redact:
    "Your masked copy is ready in Captures. Review it before replacing the original.",
  narrate: "Your narration is ready in Audio.",
  music: "Your music is ready in Audio.",
  sound: "Your sound effect is ready in Audio.",
};
export function useJobNotifications(
  jobs: Job[],
  notice: (s: string) => void,
  error: (s: string) => void,
) {
  const observed = useRef(new Map<string, string>());
  useEffect(() => {
    for (const job of jobs) {
      const previous = observed.current.get(job.id);
      if (previous && previous !== job.state) {
        if (job.state === "completed") notice(completed[job.kind]);
        if (job.state === "failed" || job.state === "unknown")
          error(job.error || "A job needs attention. Open Export for details.");
      }
      observed.current.set(job.id, job.state);
    }
  }, [jobs, notice, error]);
  return observed;
}
