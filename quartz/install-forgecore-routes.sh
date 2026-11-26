#!/usr/bin/env bash
# Forgecore 5-Size Universal Provider Route Installer (macOS / Linux / WSL)
# Powered by © 2026 Threadforge Inc.
set -euo pipefail
TARGET_DIR="$HOME/.threadforge/forgecore-gateway"
mkdir -p "$TARGET_DIR"
BASE="https://threadforgeofficial.com/quartz"

echo "==> [1/3] Upgraded Build Fetch: Syncing Forgecore 5-Size Manifest & Universal Gateway..."
curl -fsSL "$BASE/models.manifest.json" -o "$TARGET_DIR/models.manifest.json"
curl -fsSL "$BASE/forgecore-universal-gateway.mjs" -o "$TARGET_DIR/forgecore-universal-gateway.mjs"

echo "==> [2/3] Checking Loopback Sovereign Port 127.0.0.1:4173..."
if ! curl -fsS "http://127.0.0.1:4173/api/health" >/dev/null 2>&1; then
  nohup node "$TARGET_DIR/forgecore-universal-gateway.mjs" >"$TARGET_DIR/gateway.log" 2>&1 &
  sleep 1
fi

echo "==> [3/3] Forgecore 5-Size Universal Gateway Ready on http://127.0.0.1:4173"
echo "  Claude Code : ANTHROPIC_BASE_URL=http://127.0.0.1:4173 ANTHROPIC_API_KEY=tfq-sovereign-local claude --model forgecore-genesis-1"
echo "  Codex / OAI : OPENAI_BASE_URL=http://127.0.0.1:4173/v1 OPENAI_API_KEY=tfq-sovereign-local codex --model forgecore-ronin-1"
echo "  Gemini CLI  : GOOGLE_GEMINI_BASE_URL=http://127.0.0.1:4173 GEMINI_API_KEY=tfq-sovereign-local gemini"
