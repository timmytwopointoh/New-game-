<#
Sector Uprising II - safe standalone repo/bootstrap for owner-authorized PC worker.
Only uses an EXISTING approved workspace root, never VEILFORGE installation or active Realm repo.
No credentials/signing keys are read or copied. Does not run GitHub Actions.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [string]$WorkspaceRoot,
  [Parameter(Mandatory=$true)]
  [ValidatePattern('^[a-f0-9]{40}$')]
  [string]$ExpectedSourceCommit,
  [string]$RepositoryOwner = "timmytwopointoh",
  [string]$RepositoryName = "Sector-Uprising-II",
  [switch]$PublishPrivateGitHub
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $WorkspaceRoot -PathType Container)) { throw "WorkspaceRoot must exist and be explicitly authorized." }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Git unavailable in this worker; no workspace changes." }
$destination = Join-Path $WorkspaceRoot "Sector-Uprising-II"
if (Test-Path -LiteralPath $destination) { throw "Destination already exists: do not overwrite or update an existing checkout." }
if ($PublishPrivateGitHub) {
  if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw "GitHub CLI unavailable; no workspace changes." }
  & gh auth status *> $null
  if ($LASTEXITCODE -ne 0) { throw "GitHub CLI is not authenticated; no workspace changes." }
  & gh repo view "$RepositoryOwner/$RepositoryName" --json name *> $null
  if ($LASTEXITCODE -eq 0) { throw "Remote repository already exists; refusing to overwrite or push." }
}
$staging = Join-Path $WorkspaceRoot ("sector2-immutable-source-" + [guid]::NewGuid().ToString("N"))
try {
  & git clone --quiet --single-branch --filter=blob:none --branch "feature/sector-uprising-ii-afterlight-v01-20261106" "https://github.com/timmytwopointoh/New-game-.git" $staging
  if ($LASTEXITCODE -ne 0) { throw "Isolated source checkout failed; no game files were modified." }
  $head = (& git -C $staging rev-parse HEAD).Trim()
  if ($head -ne $ExpectedSourceCommit) { throw "Source changed since approval. Expected $ExpectedSourceCommit, found $head. Not copying." }
  $source = Join-Path $staging "sector-uprising-ii"
  if (-not (Test-Path -LiteralPath $source -PathType Container)) { throw "Source folder missing at approved commit." }
  Copy-Item -LiteralPath $source -Destination $destination -Recurse
  & git -C $destination init -b main *> $null
  if ($LASTEXITCODE -ne 0) { throw "Git init failed. Isolated files remain at destination for inspection." }
  & git -C $destination add .
  if ($LASTEXITCODE -ne 0) { throw "Git add failed. No remote was created." }
  & git -C $destination commit -m "feat: initial isolated Sector Uprising II Afterlight and dedicated game engine"
  if ($LASTEXITCODE -ne 0) { throw "Git commit failed; configure authorized PC git identity locally, then retry after review." }
  if ($PublishPrivateGitHub) {
    & gh repo create "$RepositoryOwner/$RepositoryName" --private --source $destination --remote origin --push
    if ($LASTEXITCODE -ne 0) { throw "Private remote creation/push failed; retain local workspace, inspect GitHub permissions." }
  }
  Write-Output "SECTOR2_STATUS=workspace_created"
  Write-Output ("SECTOR2_PATH=" + $destination)
  Write-Output ("SECTOR2_SOURCE_SHA=" + $head)
  if ($PublishPrivateGitHub) { Write-Output ("SECTOR2_GITHUB=https://github.com/" + $RepositoryOwner + "/" + $RepositoryName) }
  Write-Output "SECTOR2_ANDROID_BUILD=not_started"
  Write-Output "SECTOR2_DEVICE_QA=not_started"
} finally {
  # Only clean the uniquely generated staging checkout; never touch the destination or other projects.
  if (Test-Path -LiteralPath $staging -PathType Container) { Remove-Item -LiteralPath $staging -Recurse -Force }
}
