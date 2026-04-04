# Run once after installing/upgrading a "node-portable" zip on Windows.
# Prepends the newest node-v*-win-x64 folder under %LOCALAPPDATA%\node-portable to your *User* PATH
# so Cursor, PowerShell, and cmd all see node and npm without workarounds.
$ErrorActionPreference = "Stop"
$root = Join-Path $env:LOCALAPPDATA "node-portable"
if (-not (Test-Path $root)) {
  Write-Error "Expected folder not found: $root"
}
$latest = Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match '^node-v[\d.]+-win-x64$' } |
  Sort-Object { [version]($_.Name -replace '^node-v([\d.]+)-win-x64$', '$1') } -Descending |
  Select-Object -First 1
if (-not $latest) {
  Write-Error "No node-v*-win-x64 directory under $root"
}
$nodeDir = $latest.FullName
if (-not (Test-Path (Join-Path $nodeDir "node.exe"))) {
  Write-Error "node.exe missing in $nodeDir"
}
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$parts = @()
if (-not [string]::IsNullOrEmpty($userPath)) {
  $parts = $userPath -split ';' | Where-Object { $_ -and $_.Trim() -ne '' }
}
# Drop any older node-portable entries so PATH does not accumulate.
$parts = $parts | Where-Object { $_ -notmatch '\\node-portable\\node-v' }
$newParts = @($nodeDir) + $parts
[Environment]::SetEnvironmentVariable("Path", ($newParts -join ';'), "User")
Write-Host "User PATH updated. Node dir: $nodeDir"
Write-Host "Restart Cursor (or open a new terminal) so the change applies."
