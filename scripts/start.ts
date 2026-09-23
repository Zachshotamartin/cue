import { spawn } from "node:child_process";
import { root, port } from "../packages/storage/config";
const children = [
  spawn(
    process.execPath,
    [
      `${root}/node_modules/next/dist/bin/next`,
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: `${root}/apps/editor`,
      stdio: "inherit",
      env: { ...process.env, CUE_ROOT: root },
    },
  ),
  spawn(process.execPath, ["--import", "tsx", "apps/worker/main.ts"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, CUE_ROOT: root },
  }),
];
for (const signal of ["SIGINT", "SIGTERM"] as NodeJS.Signals[])
  process.on(signal, () => children.forEach((c) => c.kill(signal)));
for (const c of children)
  c.on("exit", (code) => {
    if (code) {
      children.forEach((x) => x.kill("SIGTERM"));
      process.exitCode = code;
    }
  });
