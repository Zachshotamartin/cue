import { spawn } from "node:child_process";
import { root, port } from "../packages/storage/config";
const children = [
  spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "apps/editor",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { cwd: root, stdio: "inherit", env: { ...process.env, CUE_ROOT: root } },
  ),
  spawn(process.execPath, ["--import", "tsx", "apps/worker/main.ts"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, CUE_ROOT: root },
  }),
];
function stop(signal: NodeJS.Signals) {
  for (const c of children) c.kill(signal);
}
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
for (const c of children)
  c.on("exit", (code) => {
    if (code) {
      stop("SIGTERM");
      process.exitCode = code;
    }
  });
