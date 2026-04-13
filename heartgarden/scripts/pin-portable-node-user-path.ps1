# Run once after installing/upgrading a "node-portable" zip on Windows.
# Creates %LOCALAPPDATA%\node-portable\current -> newest node-v*-win-x64, then prepends
# that stable path to your *User* PATH so Cursor, PowerShell, and cmd see node/npm.
# Upgrades: extract a new node-v* folder, run this script again — PATH stays "...\current".
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

$linkPath = Join-Path $root "current"
if (Test-Path $linkPath) {
  # Junctions: prefer cmd rmdir — Remove-Item occasionally blocks on Windows.
  $rmdir = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "rmdir", "/q", "`"$linkPath`"" -Wait -PassThru -NoNewWindow
  if ($rmdir.ExitCode -ne 0 -and (Test-Path $linkPath)) {
    Remove-Item -LiteralPath $linkPath -Force -ErrorAction Stop
  }
}
New-Item -ItemType Junction -Path $linkPath -Target $nodeDir | Out-Null
if (-not (Test-Path (Join-Path $linkPath "node.exe"))) {
  Write-Error "Junction failed: node.exe not visible at $linkPath"
}

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$parts = @()
if (-not [string]::IsNullOrEmpty($userPath)) {
  $parts = $userPath -split ';' | Where-Object { $_ -and $_.Trim() -ne '' }
}
# Drop any node-portable entries (versioned dirs or old current) so PATH does not accumulate.
$parts = $parts | Where-Object { $_ -notmatch '\\node-portable\\' }
$newParts = @($linkPath) + $parts
[Environment]::SetEnvironmentVariable("Path", ($newParts -join ';'), "User")
Write-Host "User PATH updated. Junction: $linkPath -> $nodeDir"
Write-Host "Restart Cursor (or open a new terminal) so the change applies."
