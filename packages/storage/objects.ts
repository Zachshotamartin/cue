import fs from "node:fs/promises";
import path from "node:path";
import { get, put, del } from "@vercel/blob";
import { dataDir, cloud } from "./config";
export const cloudObjects = () =>
  process.env.CUE_STORAGE !== "local" && (cloud || !!process.env.VERCEL);
function localPath(key: string) {
  if (!/^[a-zA-Z0-9_./-]+$/.test(key) || key.split("/").includes(".."))
    throw new Error("Invalid object path.");
  return path.join(dataDir, "objects", key);
}
export async function writeObject(
  key: string,
  bytes: Buffer,
  mime = "application/octet-stream",
  overwrite = false,
) {
  if (cloudObjects()) {
    const blob = await put(key, bytes, {
      access: "private",
      contentType: mime,
      addRandomSuffix: false,
      allowOverwrite: overwrite,
      cacheControlMaxAge: 60,
    });
    return blob.pathname;
  }
  const file = localPath(key);
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await fs.writeFile(file, bytes, { flag: overwrite ? "w" : "wx" });
  return key;
}
export async function readObject(key: string) {
  if (cloudObjects()) {
    const r = await get(key, { access: "private", useCache: false });
    if (!r?.stream) throw new Error("Stored media not found.");
    return Buffer.from(await new Response(r.stream).arrayBuffer());
  }
  return fs.readFile(localPath(key));
}
export async function deleteObject(key: string) {
  if (cloudObjects()) await del(key);
  else
    await fs.unlink(localPath(key)).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== "ENOENT") throw e;
    });
}
export async function streamObject(key: string, range: string | null = null) {
  if (cloudObjects()) {
    const result = await get(key, {
      access: "private",
      headers: range ? { Range: range } : undefined,
    });
    if (!result?.stream) throw new Error("Stored media not found.");
    return { stream: result.stream, headers: result.headers };
  }
  const buffer = await readObject(key);
  return {
    stream: new Response(buffer).body!,
    headers: new Headers({ "content-length": String(buffer.length) }),
  };
}
