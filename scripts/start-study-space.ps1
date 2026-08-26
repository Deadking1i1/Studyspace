param(
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$appUrl = "http://127.0.0.1:3000"
$healthUrl = "$appUrl/api/health"

function Test-StudySpaceReady {
  try {
    $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 3
    return $response.status -eq "ok"
  }
  catch {
    return $false
  }
}

function Stop-StaleStudySpaceServer {
  $listeners = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
  foreach ($processId in ($listeners.OwningProcess | Sort-Object -Unique)) {
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $processId"
    $isStudySpaceNext = $processInfo.CommandLine -and
      $processInfo.CommandLine.Contains($projectRoot) -and
      $processInfo.CommandLine.Contains("next")

    if (-not $isStudySpaceNext) {
      throw "Port 3000 is already being used by another application. Close it and try again."
    }

    Write-Host "Restarting the existing Study Space server..."
    Stop-Process -Id $processId -Force
  }
}

Set-Location -LiteralPath $projectRoot

if (-not (Test-StudySpaceReady)) {
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "node_modules"))) {
    Write-Host "Installing Study Space dependencies..."
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) {
      throw "Study Space dependencies could not be installed."
    }
  }

  Stop-StaleStudySpaceServer

  Write-Host "Starting Study Space..."
  Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/k", "cd /d `"$projectRoot`" && npm run dev" `
    -WindowStyle Minimized

  $ready = $false
  for ($attempt = 0; $attempt -lt 120; $attempt++) {
    Start-Sleep -Milliseconds 500
    if (Test-StudySpaceReady) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    throw "Study Space did not become ready within 60 seconds. Check the server window for details."
  }
}

if (-not $NoBrowser) {
  Start-Process $appUrl
}

Write-Host "Study Space is ready at $appUrl"
