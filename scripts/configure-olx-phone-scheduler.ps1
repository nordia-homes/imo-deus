param(
  [Parameter(Mandatory = $false)]
  [string]$ProjectId = "studio-652232171-42fb6",

  [Parameter(Mandatory = $false)]
  [string]$Location = "us-central1",

  [Parameter(Mandatory = $false)]
  [string]$AppBaseUrl = "https://studio-652232171-42fb6.web.app",

  [Parameter(Mandatory = $true)]
  [string]$CronSecret,

  [Parameter(Mandatory = $false)]
  [string]$JobName = "owner-listings-olx-phone-drain",

  [Parameter(Mandatory = $false)]
  [string]$Schedule = "*/5 * * * *",

  [Parameter(Mandatory = $false)]
  [string]$TimeZone = "Europe/Bucharest"
)

$ErrorActionPreference = "Stop"

$targetUri = "$($AppBaseUrl.TrimEnd('/'))/api/owner-listings/olx-phone-drain"
$headers = "x-owner-listings-cron-secret=$CronSecret,Content-Type=application/json"
$body = "{}"

Write-Host ""
Write-Host "Configuring Cloud Scheduler job for OLX phone drain"
Write-Host "Project: $ProjectId"
Write-Host "Location: $Location"
Write-Host "Job: $JobName"
Write-Host "Target: $targetUri"
Write-Host "Schedule: $Schedule"
Write-Host "Time zone: $TimeZone"
Write-Host ""

gcloud config set project $ProjectId | Out-Null

$jobExists = $true
try {
  gcloud scheduler jobs describe $JobName --location=$Location | Out-Null
} catch {
  $jobExists = $false
}

if ($jobExists) {
  gcloud scheduler jobs update http $JobName `
    --location=$Location `
    --schedule=$Schedule `
    --time-zone=$TimeZone `
    --uri=$targetUri `
    --http-method=POST `
    --headers=$headers `
    --message-body=$body `
    --attempt-deadline=300s `
    --max-retry-attempts=0
} else {
  gcloud scheduler jobs create http $JobName `
    --location=$Location `
    --schedule=$Schedule `
    --time-zone=$TimeZone `
    --uri=$targetUri `
    --http-method=POST `
    --headers=$headers `
    --message-body=$body `
    --attempt-deadline=300s `
    --max-retry-attempts=0
}

Write-Host ""
Write-Host "Cloud Scheduler job configured successfully."
