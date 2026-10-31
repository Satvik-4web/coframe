# Reset Demo Script
Write-Host "Resetting COFRAME demo project to baseline..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/demo/reset" -Method Post
    Write-Host "Demo Project Reset Successfully!" -ForegroundColor Green
    Write-Host "Project ID: $($response.project_id)" -ForegroundColor White
    Write-Host "Context Version: $($response.context_version)" -ForegroundColor White
    Write-Host "Artifact Version: $($response.artifact_version)" -ForegroundColor White
    Write-Host "Observer Summary: $($response.summary.what_changed)" -ForegroundColor Yellow
} catch {
    Write-Host "Failed to reset demo: $_" -ForegroundColor Red
}
