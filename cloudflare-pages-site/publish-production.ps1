param(
    [string]$SourcePath = ''
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
    Write-Host "[publish] $Message"
}

function Resolve-DefaultSourcePath([string]$workspaceRoot) {
    $preferred = Get-ChildItem -Path $workspaceRoot -File -Filter '*.html' |
        Where-Object { $_.Name -match 'test' } |
        Sort-Object LastWriteTime -Descending

    if ($preferred -and $preferred.Count -gt 0) {
        return $preferred[0].FullName
    }

    $fallback = Get-ChildItem -Path $workspaceRoot -File -Filter '*.html' |
        Sort-Object LastWriteTime -Descending

    if ($fallback -and $fallback.Count -gt 0) {
        return $fallback[0].FullName
    }

    throw "No source HTML file found under: $workspaceRoot"
}

$projectRoot = $PSScriptRoot
$workspaceRoot = Split-Path -Path $projectRoot -Parent
$targetPath = Join-Path $projectRoot 'index.html'

if ([string]::IsNullOrWhiteSpace($SourcePath)) {
    $SourcePath = Resolve-DefaultSourcePath -workspaceRoot $workspaceRoot
}

$resolvedSourcePath = (Resolve-Path -LiteralPath $SourcePath).Path

Write-Step "Copy latest page to Pages folder..."
Copy-Item -LiteralPath $resolvedSourcePath -Destination $targetPath -Force

Push-Location $projectRoot
try {
    Write-Step "Deploy to Cloudflare Pages production..."
    & npx.cmd wrangler pages deploy . --project-name clockin-pages --branch production --commit-dirty=true
    if ($LASTEXITCODE -ne 0) {
        throw "Deploy failed. wrangler exit code: $LASTEXITCODE"
    }
    Write-Step "Done. Production URL: https://production.clockin-pages.pages.dev"
}
finally {
    Pop-Location
}