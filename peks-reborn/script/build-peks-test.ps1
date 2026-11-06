param(
 [Parameter(Mandatory=$true)][string]$ExpectedSourceCommit,
 [string]$OutputDirectory = 'builds'
)
$ErrorActionPreference = 'Stop'
# Run only in a newly isolated owner-authorized PC PARENT checkout of New-game-.
# Does not use GitHub Actions or modify existing Android installs/keystores.
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'git not available' }
$head=(& git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $head -ne $ExpectedSourceCommit) { throw 'Pinned source commit mismatch. Refusing build.' }
$root=Join-Path (Get-Location).Path 'peks-reborn'
if (-not (Test-Path (Join-Path $root 'script\check-production.cjs'))) { throw 'Expected Peks source missing' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node runtime required for source QA, not available' }
& node (Join-Path $root 'script\check-production.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Source QA failed. APK not built.' }
if (-not (Get-Command gradle -ErrorAction SilentlyContinue)) { throw 'PC Gradle unavailable: use the approved local installation' }
$gradle=Get-Command gradle
$android=Join-Path $root 'android'
Push-Location $android
try {
 & $gradle.Source ':app:assembleDebug' '--offline' '--no-daemon' '--stacktrace'
 if ($LASTEXITCODE -ne 0) { throw 'Offline Gradle build failed. Check approved SDK/JDK/Gradle/cached plugins; do not silently install or invoke GitHub Actions.' }
} finally { Pop-Location }
$apk=Join-Path $android 'app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path $apk)) { throw 'Gradle returned success but APK is missing' }
$dest=Join-Path (Get-Location).Path $OutputDirectory
New-Item -ItemType Directory -Path $dest -Force | Out-Null
$out=Join-Path $dest 'Peks-Plunder-v0.2-PC-TEST.apk'
Copy-Item $apk $out -Force
$size=(Get-Item $out).Length
if ($size -lt 20000) { throw 'APK unexpectedly small, refused' }
$hash=(Get-FileHash -LiteralPath $out -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Host 'PEKS_TEST_APK_BUILT=true'
Write-Host "PEKS_SOURCE_SHA=$head"
Write-Host "PEKS_APK_BYTES=$size"
Write-Host "PEKS_APK_SHA256=$hash"
Write-Host "PEKS_APK_LOCAL_PATH=$out"
Write-Host 'NOTE: This is a DEBUG-signed test package. Verify package, signature, install and real visuals before wider release.'
