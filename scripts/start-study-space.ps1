$projectRoot = Split-Path -Parent $PSScriptRoot
$appUrl = "http://127.0.0.1:3000"

Set-Location -LiteralPath $projectRoot

$running = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if (-not $running) {
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "node_modules"))) {
    Write-Host "Installing Study Space dependencies..."
    npm install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }

  Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$projectRoot`" && npm run dev"

  $ready = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 500
    if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    Write-Host "Study Space is starting. Open $appUrl in a moment."
  }
}

Start-Process $appUrl
