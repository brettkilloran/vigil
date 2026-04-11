# Stops LISTENING processes on common local dev ports (Heartgarden / Storybook / Vite-style).
$ErrorActionPreference = "SilentlyContinue"
$ports = @(3000, 3001, 6006, 6007, 8080, 5173)
$seen = [System.Collections.Generic.HashSet[int]]::new()
foreach ($port in $ports) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { [void]$seen.Add($_.OwningProcess) }
}
foreach ($procId in $seen) {
  if ($procId -le 0) { continue }
  Write-Host "Stopping PID $procId (dev port listener)"
  Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
}
if ($seen.Count -eq 0) {
  Write-Host "No listeners found on ports: $($ports -join ', ')"
}
