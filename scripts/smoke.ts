import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { origin, root, dataDir } from "../packages/storage/config";
import { inspect, run } from "../packages/storage/media";
import { shotSchema, type Asset } from "../packages/contracts";
if (!process.env.CUE_TEST_SESSION_COOKIE)
  throw new Error(
    "Provide a dedicated test account session cookie through CUE_TEST_SESSION_COOKIE. No local admin bypass is available.",
  );
const headers = { cookie: process.env.CUE_TEST_SESSION_COOKIE, origin };
async function api(route: string, method = "GET", body?: unknown) {
  const response: Response = await fetch(`${origin}/api/${route}`, {
    method,
    headers: {
      ...headers,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  assert(response.ok, data.error || `${method} ${route} failed`);
  return data;
}
async function upload(projectId: string, file: string) {
  const response: Response = await fetch(
    `${origin}/api/projects/${projectId}/media`,
    {
      method: "POST",
      headers: {
        ...headers,
        "X-Cue-Name": encodeURIComponent(path.basename(file)),
      },
      body: await fs.readFile(file),
    },
  );
  assert(response.ok, await response.clone().text());
  return (await response.json()).asset;
}
const health = await api("health");
assert.equal(health.mode, "account");
const { project: p } = await api("projects", "POST", {
  title: "Cue render verification",
  siteUrl: origin,
});
const source = await upload(p.id, path.join(root, "examples/cue-home.png"));
const tone = path.join(dataDir, "smoke-tone.wav");
await run("ffmpeg", [
  "-v",
  "error",
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=440:duration=1",
  "-af",
  "volume=0.03",
  "-y",
  tone,
]);
const audio = await upload(p.id, tone);
await fs.unlink(tone);
let revision = p.revision;
const outputs = [];
for (const format of ["landscape", "portrait"] as const) {
  const draft = {
    ...p.draft,
    format,
    musicAssetId: audio.id,
    shots: [
      shotSchema.parse({
        id: randomUUID(),
        title: "A local render",
        assetId: source.id,
        template: "reveal",
        mode: "exact-ui",
        duration: 2,
        caption: "Your product. In motion.",
        prompt: "",
        motion: "push",
        narrationAssetId: audio.id,
      }),
    ],
  };
  const edited = await api(`projects/${p.id}/edits`, "POST", {
    revision,
    draft,
  });
  revision = edited.project.revision;
  const { job } = await api(`projects/${p.id}/render`, "POST", { revision });
  const deadline = Date.now() + 180000;
  let completed: Asset | undefined;
  while (Date.now() < deadline) {
    const snapshot = await api(`projects/${p.id}`);
    const result = snapshot.jobs.find((j: any) => j.id === job.id);
    assert(
      !["failed", "unknown", "cancelled"].includes(result.state),
      result.error || result.state,
    );
    if (result.state === "completed") {
      completed = snapshot.assets.find(
        (a: any) => a.id === result.outputAssetId,
      );
      break;
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  assert(completed, "Render timed out. Check the worker.");
  const response: Response = await fetch(
    `${origin}/api/assets/${completed.id}`,
    {
      headers,
    },
  );
  assert(response.ok);
  const file = path.join(root, "docs/screenshots", `verified-${format}.mp4`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, Buffer.from(await response.arrayBuffer()));
  const info = await inspect(file),
    video = info.streams.find((s: any) => s.codec_type === "video");
  assert.equal(video.width, format === "landscape" ? 1920 : 1080);
  assert.equal(video.height, format === "landscape" ? 1080 : 1920);
  assert(info.streams.some((s: any) => s.codec_type === "audio"));
  assert(Math.abs(Number(info.format.duration) - 2) < 0.1);
  await run("ffmpeg", [
    "-v",
    "error",
    "-ss",
    "0.7",
    "-i",
    file,
    "-frames:v",
    "1",
    "-y",
    file.replace(".mp4", ".png"),
  ]);
  outputs.push({
    format,
    file,
    seconds: Number(info.format.duration),
    width: video.width,
    height: video.height,
    audio: true,
  });
}
const captions = await fetch(`${origin}/api/projects/${p.id}/captions`, {
  headers,
});
assert((await captions.text()).includes("Your product. In motion."));
const archive = await fetch(`${origin}/api/projects/${p.id}/archive`, {
  headers,
});
assert(archive.ok);
const zip = path.join(dataDir, "smoke-project.zip");
await fs.writeFile(zip, Buffer.from(await archive.arrayBuffer()));
const { stdout } = await run("unzip", ["-p", zip, "project.json"]);
const manifest = JSON.parse(stdout);
assert.equal(manifest.project.id, p.id);
assert(Array.isArray(manifest.takes));
assert(!stdout.includes(process.env.CUE_TEST_SESSION_COOKIE!));
await fs.unlink(zip);
console.log(
  JSON.stringify(
    {
      project: `${origin}/projects/${p.id}`,
      outputs,
      archive: "passed",
      captions: "passed",
    },
    null,
    2,
  ),
);
