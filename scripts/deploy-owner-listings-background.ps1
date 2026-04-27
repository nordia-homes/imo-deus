param(
  [Parameter(Mandatory = $false)]
  [string]$ProjectId = "studio-652232171-42fb6",

  [Parameter(Mandatory = $false)]
  [string]$AppHostingRegion = "us-central1",

  [Parameter(Mandatory = $false)]
  [string]$BackendId = "studio",

  [Parameter(Mandatory = $false)]
  [string]$AppBaseUrl = "https://studio-652232171-42fb6.web.app",

  [Parameter(Mandatory = $false)]
  [string]$CronSecret = ""
)

$ErrorActionPreference = "Stop"

if (-not $CronSecret) {
  $CronSecret = [guid]::NewGuid().ToString("N")
}

$tempDir = Join-Path $env:TEMP "imodeus-owner-listings"
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

$cronSecretFile = Join-Path $tempDir "OWNER_LISTINGS_CRON_SECRET.txt"
$functionsCronSecretFile = Join-Path $tempDir "OWNER_LISTINGS_FUNCTIONS_CRON_SECRET.txt"
$appBaseUrlFile = Join-Path $tempDir "OWNER_LISTINGS_APP_BASE_URL.txt"

Set-Content -Path $cronSecretFile -Value $CronSecret -NoNewline
Set-Content -Path $functionsCronSecretFile -Value $CronSecret -NoNewline
Set-Content -Path $appBaseUrlFile -Value $AppBaseUrl -NoNewline

Write-Host ""
Write-Host "Owner listings background sync deploy"
Write-Host "Project: $ProjectId"
Write-Host "Backend: $BackendId"
Write-Host "App base URL: $AppBaseUrl"
Write-Host "Cron secret: $CronSecret"
Write-Host ""

npx firebase-tools use $ProjectId

npx firebase-tools apphosting:secrets:set OWNER_LISTINGS_CRON_SECRET `
  --project $ProjectId `
  --location $AppHostingRegion `
  --data-file $cronSecretFile

npx firebase-tools apphosting:secrets:grantaccess OWNER_LISTINGS_CRON_SECRET `
  --backend $BackendId `
  --project $ProjectId `
  --location $AppHostingRegion

npx firebase-tools functions:secrets:set OWNER_LISTINGS_FUNCTIONS_CRON_SECRET `
  --project $ProjectId `
  --data-file $functionsCronSecretFile

npx firebase-tools functions:secrets:set OWNER_LISTINGS_APP_BASE_URL `
  --project $ProjectId `
  --data-file $appBaseUrlFile

Push-Location (Join-Path $PSScriptRoot "..\\functions")
try {
  npm install
  npm run build
}
finally {
  Pop-Location
}

npx firebase-tools deploy --only functions:ownerListingsBackgroundSync --project $ProjectId

Write-Host ""
Write-Host "Deploy finished."
Write-Host "Keep this cron secret safe:"
Write-Host $CronSecret
