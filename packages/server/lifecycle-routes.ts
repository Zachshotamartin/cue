import { z } from "zod";
import { json, body } from "./http";
import {
  pruneHistory,
  deleteProject,
  duplicateProject,
} from "../storage/lifecycle";
import { restoreArchive } from "../storage/restore";
import { snapshot } from "../storage/db";
import { HttpError } from "../storage/auth";
import type { Project } from "../contracts";
export async function lifecycleRoutes(
  req: Request,
  p: string[],
  owner: string,
  current: Project,
): Promise<Response | null> {
  const method = req.method,
    id = current.id;
  if (p[2] === "cleanup" && method === "POST") {
    const b = z
      .object({
        revision: z.number().int(),
        confirm: z.literal("DELETE OLD HISTORY"),
      })
      .parse(await body(req));
    return json(await pruneHistory(id, owner, b.revision));
  }
  if (p[2] === "restore-archive" && method === "POST")
    return json({ project: await restoreArchive(id, owner, await body(req)) });
  if (!p[2] && method === "GET") return json(await snapshot(id));
  if (!p[2] && method === "DELETE") {
    const b = z.object({ confirm: z.string() }).parse(await body(req));
    if (b.confirm !== current.draft.title)
      throw new HttpError(
        400,
        "Type the film name to confirm permanent deletion.",
      );
    return json(await deleteProject(id, owner));
  }
  if (p[2] === "duplicate" && method === "POST")
    return json({ project: await duplicateProject(id, owner) }, 201);
  return null;
}
