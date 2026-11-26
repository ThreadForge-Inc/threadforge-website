# Forgecore 5-Size Universal Provider Route Installer (Windows PowerShell)
# Powered by © 2026 Threadforge Inc.
$ErrorActionPreference = 'Stop'
$TargetDir = Join-Path $env:USERPROFILE ".threadforge\forgecore-gateway"
New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null

$Base = "https://threadforgeofficial.com/quartz"
Write-Host "==> [1/3] Upgraded Build Fetch: Syncing Forgecore 5-Size Manifest & Universal Gateway..." -ForegroundColor Cyan
Invoke-RestMethod -Uri "$Base/models.manifest.json" -OutFile (Join-Path $TargetDir "models.manifest.json")
Invoke-WebRequest -Uri "$Base/forgecore-universal-gateway.mjs" -OutFile (Join-Path $TargetDir "forgecore-universal-gateway.mjs") -UseBasicParsing

Write-Host "==> [2/3] Checking Loopback Sovereign Port 127.0.0.1:4173..." -ForegroundColor Cyan
$alive = $false
try {
  $h = Invoke-RestMethod -Uri "http://127.0.0.1:4173/api/health" -TimeoutSec 2
  if ($h.ok) { $alive = $true }
} catch {}

if (-not $alive) {
  Start-Process -FilePath "node" -ArgumentList "`"$TargetDir\forgecore-universal-gateway.mjs`"" -WindowStyle Hidden
  Start-Sleep -Seconds 1
}

Write-Host "==> [3/3] Forgecore 5-Size Universal Gateway Ready on http://127.0.0.1:4173" -ForegroundColor Green
Write-Host "  Claude Code : `$env:ANTHROPIC_BASE_URL='http://127.0.0.1:4173'; `$env:ANTHROPIC_API_KEY='tfq-sovereign-local'; claude --model forgecore-genesis-1"
Write-Host "  Codex / OAI : `$env:OPENAI_BASE_URL='http://127.0.0.1:4173/v1'; `$env:OPENAI_API_KEY='tfq-sovereign-local'; codex --model forgecore-ronin-1"
Write-Host "  Gemini CLI  : `$env:GOOGLE_GEMINI_BASE_URL='http://127.0.0.1:4173'; `$env:GEMINI_API_KEY='tfq-sovereign-local'"
Write-Host "  Cursor/Code : Base URL = http://127.0.0.1:4173/v1 | Key = tfq-sovereign-local | Model = forgecore-genesis-1"
