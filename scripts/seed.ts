import fs from "node:fs/promises";
import path from "node:path";
import { root, origin } from "../packages/storage/config";
import {
  projects,
  createProject,
  editProject,
  db,
} from "../packages/storage/db";
import { importMedia } from "../packages/storage/media";
import { starterStoryboard } from "../packages/director";
const existing = (await projects()).find(
  (p) => p.draft.title === "Cue — first screening",
);
if (existing) {
  console.log(`${origin}/projects/${existing.id}`);
} else {
  const p = await createProject("Cue — first screening", origin),
    sources = [];
  for (const name of ["cue-home.png", "cue-guide.png"])
    sources.push(
      await importMedia(
        p.id,
        await fs.readFile(path.join(root, "examples", name)),
        name,
        {
          title:
            name === "cue-home.png"
              ? "Your product. In motion."
              : "From browser to first screening.",
          state: name === "cue-home.png" ? "The introduction" : "How it works",
          url: origin,
        },
      ),
    );
  const draft = starterStoryboard(p.draft, sources);
  draft.cta = "Make your first film with Cue.";
  draft.shots.at(-1)!.caption = draft.cta;
  await editProject(p.id, 1, draft, "Create example film");
  console.log(`${origin}/projects/${p.id}`);
}
await db.close();
