param(
  [Parameter(Mandatory = $false)]
  [string]$ProjectId = "studio-652232171-42fb6",

  [Parameter(Mandatory = $false)]
  [string]$Location = "us-central1",

  [Parameter(Mandatory = $false)]
  [string]$AppBaseUrl = "https://studio--studio-652232171-42fb6.us-central1.hosted.app",

  [Parameter(Mandatory = $true)]
  [string]$WorkerSecret,

  [Parameter(Mandatory = $false)]
  [string]$JobName = "tiktok-ads-shared-worker",

  [Parameter(Mandatory = $false)]
  [string]$Schedule = "* * * * *",

  [Parameter(Mandatory = $false)]
  [string]$TimeZone = "Etc/UTC"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  throw "Google Cloud CLI (gcloud) is required to configure the shared scheduler."
}

if ([System.Text.Encoding]::UTF8.GetByteCount($WorkerSecret) -lt 32) {
  throw "WorkerSecret must contain at least 32 UTF-8 bytes."
}

[System.Uri]$parsedBaseUrl = $null
if (-not [System.Uri]::TryCreate($AppBaseUrl, [System.UriKind]::Absolute, [ref]$parsedBaseUrl) -or $parsedBaseUrl.Scheme -ne "https") {
  throw "AppBaseUrl must be an absolute HTTPS URL."
}

$targetUri = "$($AppBaseUrl.TrimEnd('/'))/api/marketing/tiktok-ads/worker"
$headers = "x-tiktok-ads-worker-secret=$WorkerSecret,Content-Type=application/json"
$body = '{"limit":40,"concurrency":4,"maxRuntimeMs":50000}'

Write-Host "Configuring the shared TikTok Ads worker"
Write-Host "Project: $ProjectId"
Write-Host "Location: $Location"
Write-Host "Job: $JobName"
Write-Host "Target: $targetUri"
Write-Host "Schedule: $Schedule"
Write-Host "Time zone: $TimeZone"

& gcloud scheduler jobs describe $JobName "--project=$ProjectId" "--location=$Location" "--format=value(name)" --quiet *> $null
$jobExists = $LASTEXITCODE -eq 0

$commonArguments = @(
  "--location=$Location",
  "--project=$ProjectId",
  "--schedule=$Schedule",
  "--time-zone=$TimeZone",
  "--uri=$targetUri",
  "--http-method=POST",
  "--headers=$headers",
  "--message-body=$body",
  "--attempt-deadline=300s",
  "--max-retry-attempts=0",
  "--format=none",
  "--quiet"
)

if ($jobExists) {
  & gcloud scheduler jobs update http $JobName @commonArguments
} else {
  & gcloud scheduler jobs create http $JobName @commonArguments
}

if ($LASTEXITCODE -ne 0) {
  throw "Cloud Scheduler configuration failed with exit code $LASTEXITCODE."
}

Write-Host "Cloud Scheduler job configured successfully."
