# Request one release APK signed with the permanent VEILFORGE Android key.
# Only use after setup-stable-signing.ps1 has configured repository secrets.
param([string]$Repo = 'timmytwopointoh/New-game-')
$ErrorActionPreference = 'Stop'
$Branch = 'sandbox/realm-ai-stable-signing-20261030'
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'GitHub CLI (gh) is required.' }
& gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Use gh auth login on your PC.' }
$stamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fffffff')
$path = "realm-ai-phone-build/stable-build-requests/$stamp.txt"
$message = "Request stable-signed Realm AI Android release $stamp"
$plain = "User-approved production-signing build request on $stamp UTC; no account tokens or private keys."
$encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($plain))
$request = @{ message = $message; content = $encoded; branch = $Branch } | ConvertTo-Json -Compress
$request | & gh api --method PUT "repos/$Repo/contents/$path" --input -
if ($LASTEXITCODE -ne 0) { throw 'GitHub could not create the build request.' }
Write-Host 'Stable-signed Realm AI APK requested on GitHub.' -ForegroundColor Green
Write-Host "Build history: https://github.com/$Repo/actions/workflows/realm-ai-stable-android.yml"
Write-Host "APK releases: https://github.com/$Repo/releases"
