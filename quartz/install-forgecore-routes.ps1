# Forgecore 5-Size Universal Provider Route, CLI & Claude Desktop MCP Installer (Windows PowerShell)
# Powered by © 2026 Threadforge Inc.
$ErrorActionPreference = 'Stop'
$TargetDir = Join-Path $env:USERPROFILE ".threadforge\forgecore-gateway"
New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null

$Base = "https://threadforgeofficial.com/quartz"
Write-Host "==> [1/5] Upgraded Build Fetch: Syncing Forgecore 5-Size Manifest, Gateway, CLI & MCP Stdio..." -ForegroundColor Cyan
Invoke-RestMethod -Uri "$Base/models.manifest.json" -OutFile (Join-Path $TargetDir "models.manifest.json")
Invoke-WebRequest -Uri "$Base/forgecore-universal-gateway.mjs" -OutFile (Join-Path $TargetDir "forgecore-universal-gateway.mjs") -UseBasicParsing
Invoke-WebRequest -Uri "$Base/forgecore-cli.mjs" -OutFile (Join-Path $TargetDir "forgecore-cli.mjs") -UseBasicParsing
Invoke-WebRequest -Uri "$Base/forgecore-mcp-stdio.mjs" -OutFile (Join-Path $TargetDir "forgecore-mcp-stdio.mjs") -UseBasicParsing

Write-Host "==> [2/5] Registering 'forgecore' CLI command in User PATH ($env:APPDATA\npm)..." -ForegroundColor Cyan
$NpmBin = Join-Path $env:APPDATA "npm"
New-Item -ItemType Directory -Path $NpmBin -Force | Out-Null
Set-Content -Path (Join-Path $NpmBin "forgecore.cmd") -Value "@echo off`r`nnode `"$TargetDir\forgecore-cli.mjs`" %*" -Encoding ASCII
Set-Content -Path (Join-Path $NpmBin "forgecore.ps1") -Value "& node `"$TargetDir\forgecore-cli.mjs`" @args" -Encoding UTF8

Write-Host "==> [3/5] Registering Official MCP Server inside Claude Desktop (%APPDATA%\Claude\claude_desktop_config.json)..." -ForegroundColor Cyan
$ClaudeDir = Join-Path $env:APPDATA "Claude"
if (Test-Path $ClaudeDir) {
  $ClaudeCfgPath = Join-Path $ClaudeDir "claude_desktop_config.json"
  $NodeExe = (Get-Command node).Source
  $McpScript = Join-Path $TargetDir "forgecore-mcp-stdio.mjs"
  node -e "
    const fs = require('fs');
    const p = process.argv[1];
    let cfg = {};
    try { if (fs.existsSync(p)) cfg = JSON.parse(fs.readFileSync(p, 'utf8')); } catch {}
    cfg.mcpServers = cfg.mcpServers || {};
    cfg.mcpServers['forgecore-5size'] = {
      command: process.argv[2],
      args: [process.argv[3]]
    };
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf8');
  " $ClaudeCfgPath $NodeExe $McpScript
  Write-Host "    Added mcpServers.forgecore-5size to Claude Desktop config (Quit & reopen Claude.exe to see Tools)." -ForegroundColor Green
}

Write-Host "==> [4/5] Ensuring Loopback Sovereign Port 127.0.0.1:4173 is Live..." -ForegroundColor Cyan
$alive = $false
try {
  $h = Invoke-RestMethod -Uri "http://127.0.0.1:4173/api/health" -TimeoutSec 2
  if ($h.ok) { $alive = $true }
} catch {}

if (-not $alive) {
  Start-Process -FilePath "node" -ArgumentList "`"$TargetDir\forgecore-universal-gateway.mjs`"" -WindowStyle Hidden
  Start-Sleep -Seconds 1
}

[Environment]::SetEnvironmentVariable("FORGECORE_BASE_URL", "http://127.0.0.1:4173", "User")

Write-Host "==> [5/5] INSTALLED! Available routes:" -ForegroundColor Green
Write-Host "  1. Claude Desktop App   : Quit Claude from system tray & reopen -> click '+' / Tools -> forgecore-5size (Spark..Titan)"
Write-Host "  2. PowerShell CLI       : forgecore"
Write-Host "  3. ThreadForge Quartz   : Open ThreadForge Quartz Desktop (all 6 Owner emails unlocked)"
