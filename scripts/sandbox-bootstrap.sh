#!/usr/bin/env bash
set -euo pipefail
# A repeated dispatch cannot start a second renderer in this named sandbox.
mkdir /tmp/cue-render-lock 2>/dev/null || exit 0
if command -v dnf >/dev/null; then
  sudo dnf install -y nss atk at-spi2-atk cups-libs libdrm libXcomposite libXdamage libXrandr mesa-libgbm alsa-lib pango libxkbcommon
else
  sudo apt-get update -qq
  sudo apt-get install -y libnss3 libatk-bridge2.0-0 libcups2 libdrm2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2t64 libpango-1.0-0 libxkbcommon0
fi
npm ci --no-audit --no-fund > /tmp/cue-install.log 2>&1
node --import tsx scripts/sandbox-render.ts
