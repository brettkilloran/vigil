# Double-click or: powershell -ExecutionPolicy Bypass -File dev.ps1
# Starts heartgarden (Next) + Storybook together. Uses portable Node if present.
# App: http://localhost:3000  |  Storybook dev: http://localhost:6006
# If dev Storybook stays blank, run: npm run storybook:static  then open http://localhost:6007
$ErrorActionPreference = "Stop"
$portableNode = Join-Path $env:LOCALAPPDATA "node-portable\node-v24.11.0-win-x64"
if (Test-Path (Join-Path $portableNode "node.exe")) {
  $env:Path = "$portableNode;$env:Path"
}
Set-Location $PSScriptRoot
npm run dev:surfaces
