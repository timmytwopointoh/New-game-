#requires -Version 5.1
<#
Build Rovekin on the OWNER'S WINDOWS PC, never in hosted GitHub Actions.
Run in a SEPARATE approved checkout, at the exact source SHA supplied by VF-0019.
Requires existing PC Gradle, SDK, JDK, bundled Node deps/native libs and the
ORIGINAL private Android signing key. Does not install to phone/emulator, publish
an automatic update, modify other checkouts or create a replacement keystore.
Example: .\build-rovekin-on-pc.ps1 -RepositoryRoot 'D:\approved\Rovekin' -ExpectedCommit '<SHA>' -KeystorePath '<existing key>' -PasswordFile '<existing password file>' -OutputDirectory 'D:\approved\output' -GradlePath '<installed gradle.bat>' -AndroidSdkPath '<installed SDK>'
#>
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$RepositoryRoot,
 [Parameter(Mandatory=$true)][string]$ExpectedCommit,
 [Parameter(Mandatory=$true)][string]$KeystorePath,
 [Parameter(Mandatory=$true)][string]$PasswordFile,
 [Parameter(Mandatory=$true)][string]$OutputDirectory,
 [string]$GradlePath='',
 [string]$AndroidSdkPath=''
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$expectedCert='77694D4F0068469CB6F7FD951F84946A4BBB833AE2702DC2F87B9E0C2ADABF22'
$expectedBranch='feature/rovekin-ui-v0444-integration-20261106'
$expectedVersion='0.44.4-rovekin-private-ui-test'
$versionCode=200076
$appId='com.veilforge.realmagent.live'
$stage='prepare'
function StopBuild([string]$why){throw "Rovekin PC $stage failure: $why"}
function FileAt([string]$p,[string]$label){
 if(!$p -or !(Test-Path -LiteralPath $p -PathType Leaf)){StopBuild "$label unavailable in approved PC path"}
 return (Resolve-Path -LiteralPath $p).Path
}
function CheckRun([string]$exe,[string[]]$args,[string]$label){
 Write-Host "PC build stage: $label"
 & $exe @args
 if($LASTEXITCODE -ne 0){StopBuild "$label failed, exit $LASTEXITCODE"}
}
try{
 $repo=(Resolve-Path -LiteralPath $RepositoryRoot -ErrorAction Stop).Path
 $git=(Get-Command git.exe -ErrorAction Stop).Source
 $head=(& $git -C $repo rev-parse HEAD)
 if($LASTEXITCODE -ne 0 -or $head -ne $ExpectedCommit){StopBuild 'Wrong immutable source SHA'}
 $branch=(& $git -C $repo branch --show-current)
 if($branch -ne $expectedBranch){StopBuild 'Not the isolated Rovekin interface branch'}
 & $git -C $repo diff --quiet HEAD --
 if($LASTEXITCODE -ne 0){StopBuild 'Tracked checkout contains local modifications'}
 $app=Join-Path $repo 'realm-ai-phone-build\realm-ai-live-v021-overlay\android-app'
 $gradleFile=Get-Content -LiteralPath (FileAt (Join-Path $app 'app\build.gradle') 'app/build.gradle') -Raw
 if($gradleFile -notmatch 'applicationId\s+''com\.veilforge\.realmagent\.live'''){StopBuild 'Original app ID changed'}
 if($gradleFile -notmatch 'versionCode\s+200076(\s|$)'){StopBuild 'Wrong versionCode'}
 if(!$gradleFile.Contains("versionName '$expectedVersion'")){StopBuild 'Wrong versionName'}
 $native=Join-Path $app 'app\src\main\jniLibs\arm64-v8a'
 [void](FileAt (Join-Path $native 'libnode.so') 'original libnode.so')
 [void](FileAt (Join-Path $native 'libveilforge_bridge.so') 'original libveilforge_bridge.so')
 [void](FileAt (Join-Path $repo 'realm-ai-phone-build\realm-ai-live-v021-overlay\bedrock-agent\node_modules\bedrock-protocol\package.json') 'installed production node modules')
 $key=FileAt $KeystorePath 'permanent key'
 $password=FileAt $PasswordFile 'local password file'
 if(!$GradlePath){
   if($env:GRADLE_HOME){$GradlePath=Join-Path $env:GRADLE_HOME 'bin\gradle.bat'}
   else{$GradlePath=(Get-Command gradle.bat -ErrorAction Stop).Source}
 }
 $gradle=FileAt $GradlePath 'installed PC Gradle'
 if(!$AndroidSdkPath){
   if($env:ANDROID_SDK_ROOT){$AndroidSdkPath=$env:ANDROID_SDK_ROOT}
   else{$AndroidSdkPath=$env:ANDROID_HOME}
 }
 if(!$AndroidSdkPath){StopBuild 'Android SDK path unresolved, pass -AndroidSdkPath'}
 $sdk=(Resolve-Path -LiteralPath $AndroidSdkPath -ErrorAction Stop).Path
 $toolroot=Join-Path $sdk 'build-tools'
 $toolversion=Get-ChildItem -LiteralPath $toolroot -Directory |
   Sort-Object {try{[version]$_.Name}catch{[version]'0.0'}} -Descending | Select-Object -First 1
 if(!$toolversion){StopBuild 'Android build-tools missing'}
 $zipalign=FileAt (Join-Path $toolversion.FullName 'zipalign.exe') 'zipalign'
 $apksigner=FileAt (Join-Path $toolversion.FullName 'apksigner.bat') 'apksigner'
 $aapt=FileAt (Join-Path $toolversion.FullName 'aapt.exe') 'aapt'
 $env:ANDROID_HOME=$sdk;$env:ANDROID_SDK_ROOT=$sdk
 New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
 $out=(Resolve-Path -LiteralPath $OutputDirectory).Path
 $signed=Join-Path $out 'Rovekin-v0.44.4-200076-PRIVATE-PC-TEST.apk'
 $aligned=Join-Path $out 'Rovekin-v0.44.4-200076-aligned-unsigned.apk'
 $report=Join-Path $out 'Rovekin-v0.44.4-200076-build-report.json'
 if((Test-Path $signed) -or (Test-Path $aligned) -or (Test-Path $report)){StopBuild 'Output exists; choose a new directory'}
 $stage='Gradle'
 Push-Location $app
 try{CheckRun $gradle @('--no-daemon',':app:testDebugUnitTest',':app:assembleDebug') 'compile Java, unit tests, package on-device Node APK'}
 finally{Pop-Location}
 $stage='verification and signing'
 $unsigned=FileAt (Join-Path $app 'app\build\outputs\apk\debug\app-debug.apk') 'compiled APK'
 $badging=(& $aapt dump badging $unsigned | Select-Object -First 1)
 if($LASTEXITCODE -ne 0 -or $badging -notmatch "package: name='$appId' versionCode='$versionCode'"){StopBuild 'APK package/version invalid'}
 CheckRun $zipalign @('-f','-P','16','4',$unsigned,$aligned) 'align APK'
 CheckRun $apksigner @('sign','--ks',$key,'--ks-key-alias','realm-live-update','--ks-pass',"file:$password",'--out',$signed,$aligned) 'original permanent-key signing'
 $verify=(& $apksigner verify --verbose --print-certs $signed | Out-String)
 if($LASTEXITCODE -ne 0){StopBuild 'Signature verifier rejected APK'}
 $certMatch=[regex]::Match($verify,'Signer #1 certificate SHA-256 digest:\s*([0-9a-fA-F]+)')
 if(!$certMatch.Success -or $certMatch.Groups[1].Value.ToUpperInvariant() -ne $expectedCert){StopBuild 'Wrong signing certificate'}
 CheckRun $zipalign @('-c','-P','16','4',$signed) 'verify alignment'
 $sha=(Get-FileHash -LiteralPath $signed -Algorithm SHA256).Hash.ToLowerInvariant()
 $size=(Get-Item -LiteralPath $signed).Length
 [ordered]@{
  schema=1;status='built_signed_pc';sourceCommit=$ExpectedCommit
  packageName=$appId;versionCode=$versionCode;versionName=$expectedVersion
  certificateSha256=$expectedCert;apkName=[IO.Path]::GetFileName($signed)
  sha256=$sha;bytes=$size
  gradleTests='passed';emulator='not_run';privateArtifactUpload='not_performed'
 } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $report -Encoding UTF8
 Remove-Item -LiteralPath $aligned
 Write-Host "ROVEKIN_PC_BUILD_OK SHA256=$sha BYTES=$size"
 Write-Host 'The PC listener must publish the private artifact link and verified report in VF-0019.'
}catch{
 Write-Error $_.Exception.Message
 exit 1
}
