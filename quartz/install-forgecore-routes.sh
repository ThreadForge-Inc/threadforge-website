#!/usr/bin/env bash
# Forgecore 5-Size Universal Provider Route & CLI Installer (macOS / Linux / WSL)
# Powered by © 2026 Threadforge Inc.
set -euo pipefail
TARGET_DIR="$HOME/.threadforge/forgecore-gateway"
mkdir -p "$TARGET_DIR" "$HOME/.local/bin"
BASE="https://threadforgeofficial.com/quartz"

echo "==> [1/3] Upgraded Build Fetch: Syncing Forgecore 5-Size Manifest, Gateway & CLI..."
curl -fsSL "$BASE/models.manifest.json" -o "$TARGET_DIR/models.manifest.json"
curl -fsSL "$BASE/forgecore-universal-gateway.mjs" -o "$TARGET_DIR/forgecore-universal-gateway.mjs"
curl -fsSL "$BASE/forgecore-cli.mjs" -o "$TARGET_DIR/forgecore-cli.mjs"
chmod +x "$TARGET_DIR/forgecore-cli.mjs"
ln -sf "$TARGET_DIR/forgecore-cli.mjs" "$HOME/.local/bin/forgecore"

echo "==> [2/3] Ensuring Loopback Sovereign Port 127.0.0.1:4173 is Live..."
if ! curl -fsS "http://127.0.0.1:4173/api/health" >/dev/null 2>&1; then
  nohup node "$TARGET_DIR/forgecore-universal-gateway.mjs" >"$TARGET_DIR/gateway.log" 2>&1 &
  sleep 1
fi

echo "==> [3/3] Forgecore Ready! Run: node ~/.threadforge/forgecore-gateway/forgecore-cli.mjs --model forgecore-genesis-1"
