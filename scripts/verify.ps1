# COFRAME Verification Script
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "COFRAME — Running Verification Suite & Automated Tests" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Run Unit & Integration Tests
Write-Host "`n[1/2] Running Pytest Suite (12 tests)..." -ForegroundColor Yellow
python -m pytest backend/tests/test_backend.py backend/tests/test_api_endpoints.py -v
if ($LASTEXITCODE -ne 0) {
    Write-Host "Pytest suite failed!" -ForegroundColor Red
    exit 1
}

# 2. Run Playwright E2E Test
Write-Host "`n[2/2] Running Playwright End-to-End Workflow Test..." -ForegroundColor Yellow
python backend/tests/test_playwright_e2e.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "Playwright E2E test failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "All COFRAME Verification Tests PASSED with 100% Success!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
