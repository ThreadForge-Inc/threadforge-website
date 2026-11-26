# Forgecore 5-Size Universal Provider Route & CLI Installer (Windows PowerShell)
# Powered by © 2026 Threadforge Inc.
$ErrorActionPreference = 'Stop'
$TargetDir = Join-Path $env:USERPROFILE ".threadforge\forgecore-gateway"
New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null

$Base = "https://threadforgeofficial.com/quartz"
Write-Host "==> [1/4] Upgraded Build Fetch: Syncing Forgecore 5-Size Manifest, Gateway & CLI..." -ForegroundColor Cyan
Invoke-RestMethod -Uri "$Base/models.manifest.json" -OutFile (Join-Path $TargetDir "models.manifest.json")
Invoke-WebRequest -Uri "$Base/forgecore-universal-gateway.mjs" -OutFile (Join-Path $TargetDir "forgecore-universal-gateway.mjs") -UseBasicParsing
Invoke-WebRequest -Uri "$Base/forgecore-cli.mjs" -OutFile (Join-Path $TargetDir "forgecore-cli.mjs") -UseBasicParsing

Write-Host "==> [2/4] Registering 'forgecore' CLI command in User PATH ($env:APPDATA\npm)..." -ForegroundColor Cyan
$NpmBin = Join-Path $env:APPDATA "npm"
New-Item -ItemType Directory -Path $NpmBin -Force | Out-Null
Set-Content -Path (Join-Path $NpmBin "forgecore.cmd") -Value "@echo off`r`nnode `"$TargetDir\forgecore-cli.mjs`" %*" -Encoding ASCII
Set-Content -Path (Join-Path $NpmBin "forgecore.ps1") -Value "& node `"$TargetDir\forgecore-cli.mjs`" @args" -Encoding UTF8

Write-Host "==> [3/4] Ensuring Loopback Sovereign Port 127.0.0.1:4173 is Live..." -ForegroundColor Cyan
$alive = $false
try {
  $h = Invoke-RestMethod -Uri "http://127.0.0.1:4173/api/health" -TimeoutSec 2
  if ($h.ok) { $alive = $true }
} catch {}

if (-not $alive) {
  Start-Process -FilePath "node" -ArgumentList "`"$TargetDir\forgecore-universal-gateway.mjs`"" -WindowStyle Hidden
  Start-Sleep -Seconds 1
}

# Persist user-level OpenAI/Forgecore environment defaults safely
[Environment]::SetEnvironmentVariable("FORGECORE_BASE_URL", "http://127.0.0.1:4173", "User")

Write-Host "==> [4/4] INSTALLED! Run 'forgecore' in PowerShell right now:" -ForegroundColor Green
Write-Host "  1. Native Forgecore CLI : forgecore --model forgecore-genesis-1 `"Hello Forgecore`""
Write-Host "  2. Interactive Console  : forgecore"
Write-Host "  3. Codex CLI            : `$env:OPENAI_BASE_URL='http://127.0.0.1:4173/v1'; `$env:OPENAI_API_KEY='tfq-sovereign-local'; codex --model forgecore-ronin-1"
Write-Host "  4. Qwen CLI             : `$env:OPENAI_BASE_URL='http://127.0.0.1:4173/v1'; `$env:OPENAI_API_KEY='tfq-sovereign-local'; qwen"
