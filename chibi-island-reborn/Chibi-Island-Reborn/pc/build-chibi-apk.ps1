# Android-first Chibi Island Reborn. All tool downloads are version-pinned official Godot files,
# SHA512-verified, and confined to the Chibi Island portable cache. No machine-wide install.
param(
  [Parameter(Mandatory=$true)][string]$ProjectRoot
)
$ErrorActionPreference = 'Stop'
$project = (Resolve-Path -LiteralPath $ProjectRoot).Path
if (-not (Test-Path -LiteralPath (Join-Path $project 'project.godot'))) { throw 'CHIBI_BLOCKER: native Godot project missing' }
if (-not (Test-Path -LiteralPath (Join-Path $project 'export_presets.cfg'))) { throw 'CHIBI_BLOCKER: Android export preset missing' }
$tools = Join-Path $env:LOCALAPPDATA 'ChibiIsland-Portable-Tools'
$engine = Join-Path $tools 'Godot-4.3'
$version = '4.3-stable'
$release = 'https://github.com/godotengine/godot/releases/download/4.3-stable/'
$checks = Join-Path $tools 'SHA512-SUMS.txt'
$zip = Join-Path $tools 'Godot_v4.3-stable_win64.exe.zip'
$templates = Join-Path $tools 'Godot_v4.3-stable_export_templates.tpz'
New-Item -ItemType Directory -Path $tools,$engine -Force | Out-Null
function Download-Verified([string]$name,[string]$target) {
  if (-not(Test-Path -LiteralPath $checks)) {
    Invoke-WebRequest -Uri ($release+'SHA512-SUMS.txt') -OutFile $checks -TimeoutSec 120
  }
  $expectedLine = Get-Content -LiteralPath $checks | Where-Object {
    $_ -match ('\s\*?'+[regex]::Escape($name)+'$')
  } | Select-Object -First 1
  if (-not $expectedLine) {throw ('CHIBI_BLOCKER: official SHA512 entry missing for '+$name)}
  $expected = (($expectedLine -split '\s+')[0]).Trim().ToLowerInvariant()
  if ($expected -notmatch '^[0-9a-f]{128}$') {throw 'CHIBI_BLOCKER: malformed Godot checksum'}
  if ((Test-Path -LiteralPath $target) -and (Get-FileHash -LiteralPath $target -Algorithm SHA512).Hash.ToLowerInvariant() -eq $expected) {
    Write-Host ('CHIBI_REUSE_VERIFIED_TOOL: '+$name)
    return
  }
  if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Force }
  $partial = $target+'.partial'
  if (Test-Path -LiteralPath $partial) {Remove-Item -LiteralPath $partial -Force}
  Invoke-WebRequest -Uri ($release+$name) -OutFile $partial -TimeoutSec 3600
  $actual = (Get-FileHash -LiteralPath $partial -Algorithm SHA512).Hash.ToLowerInvariant()
  if ($actual -ne $expected) {
    Remove-Item -LiteralPath $partial -Force
    throw ('CHIBI_BLOCKER: SHA512 mismatch for official file '+$name)
  }
  Move-Item -LiteralPath $partial -Destination $target
  Write-Host ('CHIBI_OFFICIAL_SHA512_VERIFIED: '+$name)
}
$godot = Join-Path $engine 'Godot_v4.3-stable_win64.exe'
if (-not(Test-Path -LiteralPath $godot)) {
  Download-Verified 'Godot_v4.3-stable_win64.exe.zip' $zip
  Expand-Archive -LiteralPath $zip -DestinationPath $engine -Force
}
if (-not(Test-Path -LiteralPath $godot)) {throw 'CHIBI_BLOCKER: portable Godot editor missing after extraction'}
# _sc_ redirects editor data and configs to this game's own folder, not global Godot settings.
$sc = Join-Path $engine '_sc_'
if (-not (Test-Path -LiteralPath $sc)) { [IO.File]::WriteAllText($sc,'') }
$editorData = Join-Path $engine 'editor_data'
$templateDest = Join-Path $editorData 'export_templates\4.3.stable'
New-Item -ItemType Directory -Force -Path $templateDest | Out-Null
$androidDebug = Join-Path $templateDest 'android_debug.apk'
$androidRelease = Join-Path $templateDest 'android_release.apk'
if (-not ((Test-Path -LiteralPath $androidDebug) -and (Test-Path -LiteralPath $androidRelease))) {
  Download-Verified 'Godot_v4.3-stable_export_templates.tpz' $templates
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [IO.Compression.ZipFile]::OpenRead($templates)
  try {
    foreach($part in @('android_debug.apk','android_release.apk')) {
      $entry = $archive.Entries | Where-Object { $_.FullName -match ('(^|/)'+$part+'$') } | Select-Object -First 1
      if (-not $entry) {throw ('CHIBI_BLOCKER: official Android export template missing: '+$part)}
      [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,(Join-Path $templateDest $part),$true)
    }
  } finally {$archive.Dispose()}
}
if (-not ((Test-Path $androidDebug) -and (Test-Path $androidRelease))) {throw 'CHIBI_BLOCKER: Android templates not installed'}
Write-Host 'CHIBI_PORTABLE_GODOT_43_AND_TEMPLATES: READY'
$sdk = $env:ANDROID_SDK_ROOT
if (-not $sdk) {$sdk = $env:ANDROID_HOME}
if (-not $sdk) {$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'}
if (-not(Test-Path (Join-Path $sdk 'platform-tools\adb.exe'))) {throw 'CHIBI_BLOCKER: existing Android SDK not detected'}
$env:ANDROID_SDK_ROOT = $sdk
$env:ANDROID_HOME = $sdk
$javaHome = $env:JAVA_HOME
if (-not $javaHome -or -not(Test-Path (Join-Path $javaHome 'bin\keytool.exe'))) {
  foreach($p in @((Join-Path $env:ProgramFiles 'Android\Android Studio\jbr'),(Join-Path $env:ProgramFiles 'Eclipse Adoptium\jdk-17'))) {
    if (Test-Path (Join-Path $p 'bin\keytool.exe')) {$javaHome = $p; break}
  }
}
if (-not $javaHome -or -not(Test-Path (Join-Path $javaHome 'bin\keytool.exe'))) {throw 'CHIBI_BLOCKER: approved local JDK17 not found'}
$env:JAVA_HOME = $javaHome
$env:PATH = (Join-Path $javaHome 'bin') + ';' + $env:PATH
# Initialize the isolated editor first; inspect error lines rather than trusting exit code alone.
$previousError = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
  $importOutput = (& $godot --headless --editor --path $project --quit 2>&1 | Out-String)
  $importExit = $LASTEXITCODE
} finally {$ErrorActionPreference = $previousError}
Write-Host $importOutput
if ($importExit -ne 0 -or $importOutput -match '(?im)Parse Error|SCRIPT ERROR|Failed to load script') {
  throw 'CHIBI_GODOT_PARSE_OR_IMPORT_FAILED: see actual Godot compiler errors'
}
Write-Host 'CHIBI_GODOT_NATIVE_IMPORT: PASS'
# Apply settings only in the portable, self-contained Chibi tool directory.
$settingsFile = Join-Path $editorData 'editor_settings-4.tres'
if (-not(Test-Path $settingsFile)) {throw 'CHIBI_BLOCKER: portable Godot settings not initialized'}
$settings = [IO.File]::ReadAllText($settingsFile)
function Set-EditorSetting([string]$key,[string]$value) {
  $escaped = $value.Replace('\','/').Replace('"','\"')
  $line = $key+' = "'+$escaped+'"'
  if ($script:settings -match ('(?m)^'+[regex]::Escape($key)+'\s*=')) {
    $script:settings = [regex]::Replace($script:settings,('(?m)^'+[regex]::Escape($key)+'\s*=.*$'),$line)
  } else {
    $script:settings += [Environment]::NewLine+$line
  }
}
Set-EditorSetting 'export/android/java_sdk_path' $javaHome
Set-EditorSetting 'export/android/android_sdk_path' $sdk
[IO.File]::WriteAllText($settingsFile,$settings)
# The test key is local and Chibi-only. Never access Realm/Peks or other game keys.
$localKey = Join-Path $tools 'chibi-debug.keystore'
if (-not(Test-Path $localKey)) {
  & (Join-Path $javaHome 'bin\keytool.exe') -genkeypair -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -keystore $localKey -storepass android -keypass android -dname 'CN=Chibi Island Preview,OU=ChibiWorld,O=VEILFORGE,L=Local,C=US'
  if ($LASTEXITCODE -ne 0) {throw 'CHIBI_BLOCKER: standalone debug signing key failed'}
}
$env:GODOT_ANDROID_KEYSTORE_DEBUG_PATH = $localKey
$env:GODOT_ANDROID_KEYSTORE_DEBUG_USER = 'androiddebugkey'
$env:GODOT_ANDROID_KEYSTORE_DEBUG_PASSWORD = 'android'
$outputDir = Join-Path $project 'build'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$apk = Join-Path $outputDir 'Chibi-Island-Reborn-v0.1-Android-TEST.apk'
if (Test-Path $apk) {throw 'CHIBI_BLOCKER: refusing to overwrite prior APK'}
$ErrorActionPreference = 'Continue'
try {
  $exportOutput = (& $godot --headless --path $project --export-debug Android $apk 2>&1 | Out-String)
  $exportExit = $LASTEXITCODE
} finally {$ErrorActionPreference = 'Stop'}
Write-Host $exportOutput
if ($exportExit -ne 0 -or -not(Test-Path -LiteralPath $apk)) {throw 'CHIBI_ANDROID_APK_BUILD_FAILED: Godot export errors above'}
$aapt = Join-Path $sdk 'build-tools\35.0.0\aapt.exe'
$apksigner = Join-Path $sdk 'build-tools\35.0.0\apksigner.bat'
if (-not(Test-Path $aapt) -or -not(Test-Path $apksigner)) {throw 'CHIBI_BLOCKER: Android APK verification tools absent'}
$badge = (& $aapt dump badging $apk | Out-String)
if ($LASTEXITCODE -ne 0 -or $badge -notmatch "package: name='com\.veilforge\.chibiisland\.reborn'") {throw 'CHIBI_BUILD_FAILED: package ID mismatch'}
& $apksigner verify --verbose $apk | Out-Null
if ($LASTEXITCODE -ne 0) {throw 'CHIBI_BUILD_FAILED: test APK not signed'}
$bytes = (Get-Item -LiteralPath $apk).Length
if ($bytes -lt 1000000) {throw 'CHIBI_BUILD_FAILED: native APK unexpectedly tiny'}
$hash = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Host ('CHIBI_SIGNED_ANDROID_APK: '+$apk)
Write-Host ('CHIBI_APK_BYTES: '+$bytes)
Write-Host ('CHIBI_APK_SHA256: '+$hash)
Write-Host 'CHIBI_ANDROID_SOURCE_EXPORT_AND_SIGNATURE: PASS'
