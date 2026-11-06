# Optional, bounded parent-PC bootstrap. Never call from an offline VQ child.
param(
  [Parameter(Mandatory = $true)][string]$WorkspaceRoot,
  [Parameter(Mandatory = $true)][string]$SourceFolder,
  [switch]$PublishPrivateGitHub
)
$ErrorActionPreference = "Stop"
$Repo = "timmytwopointoh/Chibi-Island-Reborn"
if (-not (Test-Path -LiteralPath $WorkspaceRoot -PathType Container)) { throw "Approved WorkspaceRoot missing" }
if (-not (Test-Path -LiteralPath $SourceFolder -PathType Container)) { throw "SourceFolder missing" }
if (-not (Test-Path -LiteralPath (Join-Path $SourceFolder "project.godot"))) { throw "Not a Chibi Island Godot source tree" }
$dest = Join-Path (Resolve-Path -LiteralPath $WorkspaceRoot).Path "Chibi-Island-Reborn"
if (Test-Path -LiteralPath $dest) { throw "Workspace exists; no overwrite or duplicate" }
$gh = Get-Command gh -ErrorAction SilentlyContinue
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) { throw "git command unavailable" }
if ($PublishPrivateGitHub) {
  if (-not $gh) { throw "gh command unavailable" }
  & gh auth status *> $null
  if ($LASTEXITCODE -ne 0) { throw "gh not authenticated" }
  # A missing destination is expected. PowerShell 5.1 can emit a NativeCommandError
  # for gh stderr before $LASTEXITCODE can be evaluated under Stop preference.
  $prior = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & gh repo view $Repo --json visibility *> $null
    $alreadyExists = ($LASTEXITCODE -eq 0)
  } finally {
    $ErrorActionPreference = $prior
  }
  if ($alreadyExists) { throw "Target repo already exists; no overwrite" }
}
New-Item -ItemType Directory -Path $dest -ErrorAction Stop | Out-Null
Get-ChildItem -LiteralPath $SourceFolder -Force | Copy-Item -Destination $dest -Recurse -Force
Push-Location $dest
try {
  & git init -b main
  if ($LASTEXITCODE -ne 0) { throw "git init failed" }
  & git add .
  if ($LASTEXITCODE -ne 0) { throw "git add failed" }
  & git -c user.name="Chibi Island PC" -c user.email="chibi-island-pc@users.noreply.github.com" commit -m "Chibi Island Reborn original 3D engine baseline"
  if ($LASTEXITCODE -ne 0) { throw "git commit failed; ensure local git identity" }
  if ($PublishPrivateGitHub) {
    & gh repo create $Repo --private --source . --remote origin --push
    if ($LASTEXITCODE -ne 0) { throw "Private repo publish failed; inspect status without retrying blindly" }
    & gh repo view $Repo --json nameWithOwner,visibility,url
  }
  Write-Host "Standalone source path:" $dest
  Write-Host "Godot runtime and Android builds: NOT RUN"
} finally { Pop-Location }
