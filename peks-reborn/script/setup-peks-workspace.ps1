param(
 [Parameter(Mandatory=$true)][string]$WorkspaceRoot,
 [Parameter(Mandatory=$true)][string]$ExpectedSourceCommit,
 [switch]$PublishPrivateGitHub
)
$ErrorActionPreference = 'Stop'
# Only owner-approved PC parent. This is not a GitHub task executor.
$repo = 'timmytwopointoh/Peks-Plunder'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'git missing on approved PC parent' }
$actual = (& git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $actual -ne $ExpectedSourceCommit) { throw 'Source SHA mismatch; no work done' }
$source = Join-Path (Get-Location).Path 'peks-reborn'
if (-not (Test-Path (Join-Path $source 'game\index.html'))) { throw 'Peks source missing' }
if (-not (Test-Path (Join-Path $source 'game\engine.js'))) { throw 'Peks Engine missing' }
$root = (Resolve-Path -LiteralPath $WorkspaceRoot).Path
$target = Join-Path $root 'Peks-Plunder'
if (Test-Path -LiteralPath $target) { throw 'Workspace exists: refuse to overwrite' }
if ($PublishPrivateGitHub) {
 if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'GitHub CLI unavailable' }
 & gh auth status *> $null
 if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI not authenticated' }
 & gh repo view $repo *> $null
 if ($LASTEXITCODE -eq 0) { throw 'Repository exists; refuse to replace it' }
}
New-Item -ItemType Directory -Path $target -ErrorAction Stop | Out-Null
Copy-Item -Path (Join-Path $source '*') -Destination $target -Recurse -ErrorAction Stop
Push-Location $target
try {
 & git init -b main
 if ($LASTEXITCODE -ne 0) { throw 'git init failed' }
 & git add -- .
 if ($LASTEXITCODE -ne 0) { throw 'git add failed' }
 & git -c user.name='Peks PC Workspace' -c user.email='peks-engine@users.noreply.github.com' commit -m 'Initial Peks Engine from pinned owner source'
 if ($LASTEXITCODE -ne 0) { throw 'git commit failed' }
 if ($PublishPrivateGitHub) {
  & gh repo create $repo --private --source . --remote origin --push
  if ($LASTEXITCODE -ne 0) { throw 'Repo creation/push failed. Inspect existing resources before retrying.' }
 }
} finally { Pop-Location }
Write-Host 'PEKS_WORKSPACE_CREATED=true'
Write-Host ('PEKS_SOURCE_COMMIT=' + $actual)
Write-Host ('PEKS_REPOSITORY_PUBLISHED=' + [bool]$PublishPrivateGitHub)
Write-Host 'NO_APK_OR_EMULATOR_TEST'
