import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { ZipArchive } from "archiver";
const root = process.cwd(),
  dir = path.join(root, "dist/cue-capture");
await fs.mkdir(path.join(root, "apps/editor/public/downloads"), {
  recursive: true,
});
await fs.rm(dir, { recursive: true, force: true });
await fs.cp(path.join(root, "apps/extension"), dir, { recursive: true });
await fs.copyFile(
  path.join(root, "apps/editor/public/brand/cue-logo.svg"),
  path.join(dir, "cue-logo.svg"),
);
await sharp(path.join(root, "apps/editor/public/brand/cue-icon.svg"))
  .png()
  .toFile(path.join(dir, "icon.png"));
await fs.copyFile(
  path.join(
    root,
    "node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2",
  ),
  path.join(root, "apps/editor/public/brand/manrope.woff2"),
);
const archive = new ZipArchive({ zlib: { level: 9 } }),
  file = createWriteStream(
    path.join(root, "apps/editor/public/downloads/cue-capture.zip"),
  );
const done = new Promise<void>((resolve, reject) => {
  file.on("close", resolve);
  file.on("error", reject);
  archive.on("error", reject);
});
archive.pipe(file);
archive.directory(dir, "cue-capture");
await archive.finalize();
await done;
console.log("Cue Capture packaged.");
