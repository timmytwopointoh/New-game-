# Sign the unmodified, verified, original-package APK using the EXISTING key on this PC.
# Never creates, rotates, or uploads any private key.
param([string]$KeyFile = (Join-Path $env:USERPROFILE 'VEILFORGE-Android-Signing\realm-ai-update.p12'))
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$expected='B5D275706B574EEA53D6497A3A65542542B5DB0E0E57F4E307E8ED17CF24F995'
$src=Join-Path $PSScriptRoot 'Realm-AI-v0.14.3-unsigned.apk'
$hashPath=Join-Path $PSScriptRoot 'Realm-AI-v0.14.3-unsigned.SHA256.txt'
$jar=Join-Path $PSScriptRoot 'apksigner.jar'
$out=Join-Path $PSScriptRoot 'VEILFORGE-Realm-AI-v0.14.3-Permanent-Update.apk'
if (-not (Test-Path $KeyFile -PathType Leaf)) { throw "Existing permanent signing key not found at $KeyFile. DO NOT create a new key. Use the exact backup that signed v0.14." }
foreach($path in @($src,$jar,$hashPath)) { if(-not (Test-Path $path -PathType Leaf)) { throw "Missing signing kit file: $path" } }
foreach($tool in @('java','keytool')) { if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Missing $tool. Install JDK 17 before signing." } }
if (Test-Path $out) { throw "Output already exists; move the previous APK first so it cannot be overwritten." }
$expectedUnsigned=(Get-Content $hashPath -Raw).Trim().Split(' ')[0].ToUpperInvariant()
if ($expectedUnsigned -notmatch '^[0-9A-F]{64}$') { throw 'Invalid unsigned APK checksum manifest.' }
$actualUnsigned=(Get-FileHash $src -Algorithm SHA256).Hash.ToUpperInvariant()
if ($actualUnsigned -ne $expectedUnsigned) { throw 'Unsigned APK hash mismatch. Refusing to sign.' }
Write-Host 'Original package ID: com.veilforge.realmagent; versionCode 100005 (verified by GitHub build).' -ForegroundColor Cyan
Write-Host 'This will sign with your EXISTING realm-ai-update.p12 key. No file is uploaded.' -ForegroundColor Cyan
$secure=Read-Host 'Password for the EXISTING permanent key' -AsSecureString
$bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {$pw=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)}
finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)}
try {
  $env:VF_SIGNING_PASS=$pw
  $cert=(& keytool -list -v -storetype PKCS12 -keystore $KeyFile -alias realm-ai-update -storepass:env VF_SIGNING_PASS 2>&1) -join [char]10
  if ($LASTEXITCODE -ne 0) { throw 'Could not open original keystore; check the original password.' }
  $match=[regex]::Match($cert,'(?im)SHA256:\s*([0-9a-f:]{64,})')
  if (-not $match.Success) { throw 'Could not read the signing certificate fingerprint.' }
  $fingerprint=($match.Groups[1].Value -replace ':','').ToUpperInvariant()
  if ($fingerprint -ne $expected) { throw "STOP: This is not the certificate used for the installed v0.14 app. Refusing to sign." }
  & java -jar $jar sign --ks $KeyFile --ks-type PKCS12 --ks-key-alias realm-ai-update --ks-pass env:VF_SIGNING_PASS --out $out $src
  if ($LASTEXITCODE -ne 0) { throw 'APK signing failed.' }
  $verification=(& java -jar $jar verify --verbose --print-certs $out 2>&1) -join [char]10
  if ($LASTEXITCODE -ne 0 -or $verification -notmatch "(?i)Signer #1 certificate SHA-256 digest:\s*$expected") {
    Remove-Item -LiteralPath $out -ErrorAction SilentlyContinue
    throw 'Signed APK verification did not match the original certificate.'
  }
  Write-Host 'SUCCESS: original certificate verified. Your real in-place update is:' -ForegroundColor Green
  Write-Host $out
  Write-Host 'Transfer this APK to the phone and install OVER the existing v0.14 app. Do not uninstall.' -ForegroundColor Green
}
finally {
  Remove-Item Env:\VF_SIGNING_PASS -ErrorAction SilentlyContinue
  $pw=$null
  $secure=$null
}
