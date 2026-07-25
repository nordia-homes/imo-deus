param(
  [string]$ApiKey = $env:BROWSERBASE_API_KEY
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
  throw "BROWSERBASE_API_KEY este obligatoriu."
}

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$extensionRoot = Join-Path $workspaceRoot "extensions\imodeus-olx-phone"
$archivePath = Join-Path $workspaceRoot "tmp\imodeus-olx-phone-extension.zip"

if (-not (Test-Path -LiteralPath $extensionRoot)) {
  throw "Directorul extensiei nu exista: $extensionRoot"
}

$resolvedWorkspace = [System.IO.Path]::GetFullPath($workspaceRoot)
$resolvedArchive = [System.IO.Path]::GetFullPath($archivePath)
if (-not $resolvedArchive.StartsWith($resolvedWorkspace, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Arhiva extensiei trebuie sa ramana in workspace."
}

$archiveDirectory = Split-Path -Parent $archivePath
New-Item -ItemType Directory -Path $archiveDirectory -Force | Out-Null
if (Test-Path -LiteralPath $archivePath) {
  Remove-Item -LiteralPath $archivePath -Force
}
Compress-Archive -Path (Join-Path $extensionRoot "*") -DestinationPath $archivePath -CompressionLevel Optimal

$httpClient = [System.Net.Http.HttpClient]::new()
$fileStream = $null
$multipart = $null
try {
  $httpClient.DefaultRequestHeaders.Add("X-BB-API-Key", $ApiKey)
  $fileStream = [System.IO.File]::OpenRead($archivePath)
  $fileContent = [System.Net.Http.StreamContent]::new($fileStream)
  $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::new("application/zip")
  $multipart = [System.Net.Http.MultipartFormDataContent]::new()
  $multipart.Add($fileContent, "file", [System.IO.Path]::GetFileName($archivePath))
  $responseMessage = $httpClient.PostAsync(
    "https://api.browserbase.com/v1/extensions",
    $multipart
  ).GetAwaiter().GetResult()
  $response = $responseMessage.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  if (-not $responseMessage.IsSuccessStatusCode) {
    throw "Browserbase extension upload a esuat cu statusul $([int]$responseMessage.StatusCode)."
  }
  $payload = $response | ConvertFrom-Json
} finally {
  if ($multipart) { $multipart.Dispose() }
  if ($fileStream) { $fileStream.Dispose() }
  $httpClient.Dispose()
  if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
  }
}

if ([string]::IsNullOrWhiteSpace($payload.id)) {
  throw "Browserbase nu a returnat identificatorul extensiei."
}

Write-Output $payload.id
