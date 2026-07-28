$env:STUDY_SPACE_DATABASE_URL = "postgresql://study_space:study_space@127.0.0.1:5432/study_space"
$env:AUTH_SECRET = "local-dev-auth-secret-for-study-space-1234567890"
$env:STUDY_SPACE_APP_BASE_URL = "http://127.0.0.1:3000"

Write-Host "Configured Study Space TypeScript development environment:"
Write-Host "  STUDY_SPACE_DATABASE_URL=$env:STUDY_SPACE_DATABASE_URL"
Write-Host "  STUDY_SPACE_APP_BASE_URL=$env:STUDY_SPACE_APP_BASE_URL"
Write-Host "  AUTH_SECRET=(set, local development only)"
