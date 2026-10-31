# One-time stable Android signing setup for VEILFORGE Realm AI.
# Run on your own Windows PC. Requires GitHub CLI (gh) and JDK 17+ (keytool).
# The keystore and password MUST NEVER be added to GitHub source code or shared in chat.
param([string]$Repo = 'timmytwopointoh/New-game-', [switch]$SkipBuildRequest)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

foreach ($name in @('gh','keytool')) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) { throw "Missing $name; install GitHub CLI and Java JDK 17+." }
}
& gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Authenticate locally first using: gh auth login" }

$aliasName = 'realm-ai-update'
$directory = Join-Path $env:USERPROFILE 'VEILFORGE-Android-Signing'
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$keyFile = Join-Path $directory 'realm-ai-update.p12'
if (Test-Path $keyFile) {
    Write-Host 'Using EXISTING key file. It will not be replaced.' -ForegroundColor Yellow
} else {
    Write-Host 'Creating a permanent signing key on THIS PC.' -ForegroundColor Cyan
}
Write-Host 'Use a password stored in your password manager. Do NOT paste it into chat.'
$secure = Read-Host 'Signing keystore password (same for future updates)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
if ($password.Length -lt 16) { throw 'Use a signing password of at least 16 characters.' }
$env:VF_SIGNING_PASS = $password
if (-not (Test-Path $keyFile)) {
    & keytool -genkeypair -noprompt -storetype PKCS12 -keystore $keyFile -alias $aliasName -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=VEILFORGE Realm AI, O=VEILFORGE' -storepass:env VF_SIGNING_PASS -keypass:env VF_SIGNING_PASS
    if ($LASTEXITCODE -ne 0) { throw 'keytool failed to create signing key.' }
}
$cert = (& keytool -list -v -storetype PKCS12 -keystore $keyFile -alias $aliasName -storepass:env VF_SIGNING_PASS) -join [char]10
if ($LASTEXITCODE -ne 0) { throw 'Cannot unlock signing keystore; check the password.' }
$match = [regex]::Match($cert,'(?i)SHA256:\s*([0-9a-f:]{95})')
if (-not $match.Success) { throw 'Cannot read signing certificate SHA256 fingerprint.' }
$fingerprint = ($match.Groups[1].Value -replace ':','').ToUpperInvariant()
# Safety: refuse to silently rotate a certificate already used for installed APKs.
$existingCert = (& gh variable list --repo $Repo --json name,value -q '.[] | select(.name=="VF_ANDROID_CERT_SHA256") | .value') -join ''
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect existing signing fingerprint; refusing to overwrite secrets.' }
if ($existingCert -and (($existingCert -replace ':','').ToUpperInvariant() -ne $fingerprint)) {
    throw 'STOP: this repository already has a DIFFERENT permanent signing certificate. Use the original key backup; do not regenerate!'
}


function Set-RepoSecret([string]$Name,[string]$Value) {
    $Value | & gh secret set $Name --repo $Repo --app actions
    if ($LASTEXITCODE -ne 0) { throw "GitHub refused to store secret $Name." }
}
# Base64 avoids trailing-newline ambiguity when passing secret data through PowerShell.
$keyBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($keyFile))
$passwordBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($password))
Set-RepoSecret 'VF_ANDROID_KEYSTORE_B64' $keyBase64
Set-RepoSecret 'VF_ANDROID_PASSWORD_B64' $passwordBase64
$fingerprint | & gh variable set VF_ANDROID_CERT_SHA256 --repo $Repo
if ($LASTEXITCODE -ne 0) { throw 'Could not set public GitHub certificate-fingerprint variable.' }
$password = $null; $secure = $null; $passwordBase64 = $null; $keyBase64 = $null
Remove-Item Env:\VF_SIGNING_PASS -ErrorAction SilentlyContinue
Write-Host 'Permanent Android signing secrets configured.' -ForegroundColor Green
Write-Host "Public signing certificate SHA256: $fingerprint"
Write-Host "BACK UP THIS PRIVATE KEY FILE SECURELY: $keyFile"
Write-Host 'Keep the password in a password manager. Losing the key prevents future in-place updates.'
if (-not $SkipBuildRequest) {
    & "$PSScriptRoot/request-stable-build.ps1" -Repo $Repo
    if ($LASTEXITCODE -ne 0) { throw 'Signing configured, but build request failed.' }
}
