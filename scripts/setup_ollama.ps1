# setup_ollama.ps1 - PowerShell script to set up Ollama and BioMistral 7B GGUF

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "MedVault - Local Ollama and BioMistral 7B GGUF Setup" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Check Ollama installation
if (!(Get-Command ollama -ErrorAction SilentlyContinue)) {
    Write-Host "[1/4] Ollama CLI not found. Attempting install via winget..." -ForegroundColor Yellow
    try {
        winget install Ollama.Ollama -e --accept-package-agreements --accept-source-agreements
    } catch {
        Write-Host "[ERROR] Winget install failed. Please download Ollama manually from https://ollama.com/download/windows" -ForegroundColor Red
        exit 1
    }
} else {
    $version = (ollama --version)
    Write-Host "[1/4] Found Ollama: $version" -ForegroundColor Green
}

# 2. Check if Ollama daemon is running
$ollamaProcess = Get-Process ollama -ErrorAction SilentlyContinue
if (!$ollamaProcess) {
    Write-Host "[2/4] Starting Ollama daemon in background..." -ForegroundColor Yellow
    Start-Process ollama -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 3
} else {
    Write-Host "[2/4] Ollama daemon is already running." -ForegroundColor Green
}

# 3. Create BioMistral model from Modelfile
$modelfilePath = Join-Path $PSScriptRoot "..\Modelfile.biomistral"
if (Test-Path $modelfilePath) {
    Write-Host "[3/4] Creating 'biomistral' model from Modelfile ($modelfilePath)..." -ForegroundColor Yellow
    ollama create biomistral -f $modelfilePath
} else {
    Write-Host "[WARN] Modelfile.biomistral not found. Pulling BioMistral directly..." -ForegroundColor Yellow
    ollama pull BioMistral/BioMistral-7B
}

# 4. Pull fallback model
Write-Host "[4/4] Pulling fallback model 'llama3.2:3b'..." -ForegroundColor Yellow
ollama pull llama3.2:3b

Write-Host "`nInstalled models:" -ForegroundColor Cyan
ollama list

Write-Host "`n[SUCCESS] Ollama setup complete! BioMistral is ready for MedVault." -ForegroundColor Green
