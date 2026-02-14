# Cloud Run Deployment Script for Last Man Standing (PowerShell)

Write-Host "Last Man Standing - Cloud Run Deployment" -ForegroundColor Yellow
Write-Host "=========================================="
Write-Host ""

# Check if gcloud is installed
try {
    $null = gcloud --version 2>$null
    if ($LASTEXITCODE -ne 0) { throw "gcloud not found" }
} catch {
    Write-Host "Error: Google Cloud SDK is not installed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install it from:" -ForegroundColor Yellow
    Write-Host "https://cloud.google.com/sdk/docs/install-windows"
    Write-Host ""
    Write-Host "After installation:"
    Write-Host "1. Restart PowerShell"
    Write-Host "2. Run: gcloud init"
    Write-Host "3. Run this script again"
    exit 1
}

Write-Host "Setting up Google Cloud project..." -ForegroundColor Yellow
gcloud config set project last-man-standing-6cc93

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to set project" -ForegroundColor Red
    exit 1
}

# Get current directory and navigate to web folder
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$webPath = Join-Path $scriptPath "web"

if (-not (Test-Path $webPath)) {
    Write-Host "Error: web folder not found" -ForegroundColor Red
    exit 1
}

Set-Location $webPath

Write-Host ""
Write-Host "Deploying to Cloud Run..." -ForegroundColor Yellow
Write-Host "This may take 2-5 minutes..." -ForegroundColor Cyan
Write-Host ""

gcloud run deploy last-man-standing `
  --source . `
  --platform managed `
  --region us-central1 `
  --allow-unauthenticated `
  --memory 512Mi `
  --timeout 600

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Deployment successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your app is now live at:" -ForegroundColor Green
    gcloud run services describe last-man-standing --region us-central1 --format="value(status.url)"
    Write-Host ""
    Write-Host "You can also view it in the Google Cloud Console:" -ForegroundColor Green
    Write-Host "https://console.cloud.google.com/run/detail/us-central1/last-man-standing"
} else {
    Write-Host "Deployment failed" -ForegroundColor Red
    exit 1
}
