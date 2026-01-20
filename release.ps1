# OpenCode Harness - GitHub Release Script

Write-Host "🚀 Starting GitHub release process..." -ForegroundColor Cyan

# 0. Set location
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath
Write-Host "Working in: $scriptPath" -ForegroundColor Gray

# 1. Build everything
Write-Host "`n📦 Building packages..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

# 2. Get Version
$version = (Get-Content -Raw "packages/cli/package.json" | ConvertFrom-Json).version
$tagName = "v$version"
Write-Host "`n🔖 Preparing release for $tagName..." -ForegroundColor Cyan

# 3. Git Operations
Write-Host "Checking git status..." -ForegroundColor Gray
if (git status --porcelain) {
    $commit = Read-Host "⚠️  Uncommitted changes found. Commit them now? (y/n)"
    if ($commit -eq 'y') {
        git add .
        git commit -m "chore: release $tagName"
    } else {
        Write-Host "❌ Please commit changes before releasing." -ForegroundColor Red
        exit 1
    }
}

# 4. Create Tag & Push
Write-Host "`n🚀 Pushing to GitHub..." -ForegroundColor Cyan
try {
    # Check if tag exists
    git rev-parse "$tagName" >$null 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "⚠️  Tag $tagName already exists. Overwrite? (y/n)"
        $overwrite = Read-Host
        if ($overwrite -eq 'y') {
            git tag -d "$tagName"
            git push origin ":refs/tags/$tagName"
        } else {
            Write-Host "❌ Release cancelled." -ForegroundColor Red
            exit 1
        }
    }

    git tag "$tagName"
    git push origin master
    git push origin "$tagName"
    
    Write-Host "`n✅ Released $tagName to GitHub!" -ForegroundColor Green
    Write-Host "Users can install via: npm install -g github:markybuilds/opencode-harness" -ForegroundColor Gray
} catch {
    Write-Host "❌ Git commands failed. Check output." -ForegroundColor Red
    exit 1
}
