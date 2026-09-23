import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
process.env.CUE_ROOT = process.cwd();
process.env.CUE_DATA_DIR = path.join(process.cwd(), ".test-data", randomUUID());
process.env.CUE_MASTER_KEY = "12".repeat(32);
for (const key of [
  "RUNWAYML_API_SECRET",
  "GEMINI_API_KEY",
  "ELEVENLABS_API_KEY",
])
  delete process.env[key];
fs.mkdirSync(process.env.CUE_DATA_DIR, { recursive: true });
