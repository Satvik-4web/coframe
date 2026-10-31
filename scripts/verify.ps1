# ==============================================================================
# COFRAME — COMPREHENSIVE AUTOMATED VERIFICATION SCRIPT (PowerShell)
# ==============================================================================

$ErrorActionPreference = "Stop"
$script:startedBackendProc = $null
$script:exitCode = 0

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "COFRAME - Pre-Demo Full Verification Suite" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

try {
    # 1. Check Python and Node Runtimes
    Write-Host "`n[1/6] Checking runtime environments..." -ForegroundColor Yellow
    $pyVer = python --version 2>&1
    Write-Host "Python version: $pyVer" -ForegroundColor White
    if ($LASTEXITCODE -ne 0) { throw "Python is not installed or not in PATH." }

    $nodeVer = node --version 2>&1
    Write-Host "Node version:   $nodeVer" -ForegroundColor White
    if ($LASTEXITCODE -ne 0) { throw "Node.js is not installed or not in PATH." }

    $npmVer = npm --version 2>&1
    Write-Host "NPM version:    $npmVer" -ForegroundColor White

    # 2. Verify Dependencies
    Write-Host "`n[2/6] Verifying Python and Node dependencies..." -ForegroundColor Yellow
    python -c "import fastapi, uvicorn, sqlalchemy, pydantic, playwright, pytest; print('Python packages verified.')"
    if ($LASTEXITCODE -ne 0) { throw "Python dependencies missing. Run pip install -r backend/requirements.txt." }

    if (-not (Test-Path "frontend/node_modules")) {
        Write-Host "Installing frontend dependencies..." -ForegroundColor Gray
        Push-Location "frontend"
        npm install
        Pop-Location
    }
    Write-Host "Frontend dependencies verified." -ForegroundColor Green

    # 3. Build React Production Distribution
    Write-Host "`n[3/6] Building React frontend distribution (npm run build)..." -ForegroundColor Yellow
    Push-Location "frontend"
    npm run build
    $buildSuccess = ($LASTEXITCODE -eq 0)
    Pop-Location
    if (-not $buildSuccess) { throw "Frontend build failed." }
    Write-Host "Frontend build completed successfully." -ForegroundColor Green

    # 4. Ensure Backend is Running & Healthy
    Write-Host "`n[4/6] Verifying backend health readiness..." -ForegroundColor Yellow
    $backendReady = $false
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($health.status -eq "online") {
            $backendReady = $true
            Write-Host "Backend already running and healthy at http://127.0.0.1:8000." -ForegroundColor Green
        }
    } catch {
        $backendReady = $false
    }

    if (-not $backendReady) {
        Write-Host "Starting backend service in background..." -ForegroundColor Gray
        $script:startedBackendProc = Start-Process python -ArgumentList "-m uvicorn backend.app.main:app --port 8000 --host 127.0.0.1" -PassThru
        
        # Poll health endpoint up to 15 seconds
        $attempts = 0
        while ($attempts -lt 15 -and -not $backendReady) {
            Start-Sleep -Seconds 1
            $attempts++
            try {
                $h = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 1 -ErrorAction SilentlyContinue
                if ($h.status -eq "online") {
                    $backendReady = $true
                    break
                }
            } catch {
                # continue polling
            }
        }
        if (-not $backendReady) { throw "Backend failed to respond on http://127.0.0.1:8000/health within 15 seconds." }
        Write-Host "Backend started and ready (PID: $($script:startedBackendProc.Id))." -ForegroundColor Green
    }

    # 5. Run Pytest Test Suite
    Write-Host "`n[5/6] Running Pytest Unit & Integration Suite (53 tests including OpenAgents, GitHub, and Prune)..." -ForegroundColor Yellow
    python -m pytest backend/tests/ -v -k "not test_playwright_e2e"
    if ($LASTEXITCODE -ne 0) { throw "Pytest suite failed." }
    Write-Host "All 53 Pytest tests PASSED." -ForegroundColor Green

    # 5b. Run Prune Workshop Prompt-to-Receipt Live Verification
    Write-Host "`nRunning Prune Workshop Prompt-to-Receipt Verification (BIOS V2)..." -ForegroundColor Yellow
    python scripts/prune_workshop_demo.py
    if ($LASTEXITCODE -ne 0) { throw "Prune workshop demo failed." }

    # 6. Run Playwright Two-Session Browser E2E Test
    Write-Host "`n[6/6] Running Playwright Headless Two-Session E2E Workflow..." -ForegroundColor Yellow
    python backend/tests/test_playwright_e2e.py
    if ($LASTEXITCODE -ne 0) { throw "Playwright E2E browser test failed." }

    if (Test-Path "docs/demo_screenshot.png") {
        $imgSize = (Get-Item "docs/demo_screenshot.png").Length
        Write-Host "Verified verification screenshot: docs/demo_screenshot.png ($imgSize bytes)." -ForegroundColor Green
    } else {
        throw "Demo screenshot was not saved."
    }

    Write-Host "`n==========================================================" -ForegroundColor Green
    Write-Host "ALL COFRAME PRE-DEMO VERIFICATION CHECKS PASSED (100% OK)" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green

} catch {
    Write-Host "`nVerification FAILED: $_" -ForegroundColor Red
    $script:exitCode = 1
} finally {
    # Clean up only processes started by this script
    if ($script:startedBackendProc -ne $null) {
        Write-Host "Cleaning up background backend process (PID: $($script:startedBackendProc.Id))..." -ForegroundColor Gray
        Stop-Process -Id $script:startedBackendProc.Id -Force -ErrorAction SilentlyContinue
    }
}

exit $script:exitCode
