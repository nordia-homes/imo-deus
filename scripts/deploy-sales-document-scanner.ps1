param(
  [string]$ProjectId = "studio-652232171-42fb6",
  [string]$Region = "us-central1",
  [string]$ServiceName = "imodeus-document-scanner",
  [string]$SecretName = "SALES_DOCUMENT_SCAN_TOKEN",
  [int]$MaximumInstances = 3
)

$ErrorActionPreference = "Stop"

function Assert-GcloudSucceeded {
  param([string]$Action)
  if ($LASTEXITCODE -ne 0) {
    throw "$Action a esuat (gcloud exit code $LASTEXITCODE)."
  }
}

if (-not (Get-Command gcloud.cmd -ErrorAction SilentlyContinue)) {
  throw "Google Cloud CLI (gcloud) nu este instalat sau nu este disponibil in PATH."
}
$gcloud = (Get-Command gcloud.cmd).Source

$image = "$Region-docker.pkg.dev/$ProjectId/imodeus-services/sales-document-scanner:latest"
$serviceDirectory = Join-Path $PSScriptRoot "..\services\sales-document-scanner"

Write-Host "Verific serviciile Google Cloud necesare..."
& $gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com --project $ProjectId
Assert-GcloudSucceeded "Activarea API-urilor Google Cloud"

$ErrorActionPreference = "Continue"
$repository = & $gcloud artifacts repositories describe imodeus-services --location $Region --project $ProjectId --format "value(name)" 2>$null
$ErrorActionPreference = "Stop"
if (-not $repository) {
  Write-Host "Creez repository-ul Artifact Registry imodeus-services..."
  & $gcloud artifacts repositories create imodeus-services --repository-format docker --location $Region --project $ProjectId --description "Imodeus private services"
  Assert-GcloudSucceeded "Crearea repository-ului Artifact Registry"
}

$ErrorActionPreference = "Continue"
$secret = & $gcloud secrets describe $SecretName --project $ProjectId --format "value(name)" 2>$null
$ErrorActionPreference = "Stop"
if (-not $secret) {
  throw "Secretul $SecretName nu exista in proiect. Creeaza-l in Secret Manager inainte de deploy."
}

Write-Host "Construiesc imaginea scannerului persistent..."
& $gcloud builds submit $serviceDirectory --tag $image --project $ProjectId
Assert-GcloudSucceeded "Build-ul imaginii scannerului"

Write-Host "Public serviciul Cloud Run cu o instanta permanent pregatita..."
& $gcloud run deploy $ServiceName `
  --image $image `
  --project $ProjectId `
  --region $Region `
  --platform managed `
  --execution-environment gen2 `
  --memory 4Gi `
  --cpu 2 `
  --concurrency 1 `
  --timeout 120s `
  --min 1 `
  --max $MaximumInstances `
  --cpu-throttling `
  --cpu-boost `
  --set-secrets "SCANNER_TOKEN=$SecretName`:latest" `
  --set-env-vars "MAX_REQUEST_BYTES=18874368,CLAMD_TIMEOUT_MS=45000,CLAMD_STARTUP_TIMEOUT_MS=180000" `
  --allow-unauthenticated `
  --quiet
Assert-GcloudSucceeded "Publicarea serviciului Cloud Run"

$serviceJson = & $gcloud run services describe $ServiceName --project $ProjectId --region $Region --format json
Assert-GcloudSucceeded "Citirea URL-ului serviciului Cloud Run"
$service = $serviceJson | ConvertFrom-Json
$serviceUrl = $service.status.url
$annotations = $service.metadata.annotations
$containerSpec = $service.spec.template.spec.containers[0]
if (
  $annotations.'run.googleapis.com/minScale' -ne '1' -or
  $annotations.'run.googleapis.com/maxScale' -ne [string]$MaximumInstances -or
  $service.spec.template.spec.containerConcurrency -ne 1 -or
  $containerSpec.resources.limits.cpu -ne '2' -or
  $containerSpec.resources.limits.memory -ne '4Gi'
) {
  throw "Serviciul a fost publicat, dar configuratia permanenta Cloud Run nu corespunde parametrilor asteptati."
}
$health = Invoke-RestMethod -Uri "$serviceUrl/health" -Method Get -TimeoutSec 30
if (-not $health.ok -or -not $health.ready -or $health.mode -ne "persistent-daemon") {
  throw "Deploy-ul s-a incheiat, dar health-check-ul scannerului persistent nu este valid."
}

Write-Host "Scanner pregatit permanent: $serviceUrl"
Write-Host "Configureaza SALES_DOCUMENT_SCAN_URL cu valoarea $serviceUrl/scan."
