param(
    [Parameter(Mandatory = $true)]
    [string]$ImageName,

    [Parameter(Mandatory = $true)]
    [string]$BuildNumber
)

$ErrorActionPreference = "Stop"

$productionContainer = "task-manager-production"
$backupContainer = "task-manager-production-backup"

# Reuse the existing production SQLite volume.
$productionVolume = "task-manager-data"

$releaseVersion = "1.0.$BuildNumber"
$sourceImage = "${ImageName}:$BuildNumber"
$releaseImage = "${ImageName}:$releaseVersion"

function Test-ContainerExists {
    param([string]$Name)

    $container = docker ps -a `
        --filter "name=^/$Name$" `
        --format "{{.Names}}"

    return $container -eq $Name
}

function Wait-ForHealthy {
    param([string]$ContainerName)

    for ($attempt = 1; $attempt -le 12; $attempt++) {

        $health = docker inspect `
            --format "{{.State.Health.Status}}" `
            $ContainerName 2>$null

        Write-Host "Health check $attempt/12 : $health"

        if ($health -eq "healthy") {
            return $true
        }

        if ($health -eq "unhealthy") {
            return $false
        }

        Start-Sleep -Seconds 5
    }

    return $false
}

if ([string]::IsNullOrWhiteSpace($env:PRODUCTION_JWT_SECRET)) {
    throw "PRODUCTION_JWT_SECRET is missing."
}

Write-Host "===== RELEASE $releaseVersion ====="
Write-Host "Source image: $sourceImage"
Write-Host "Release image: $releaseImage"

# Ensure the exact Jenkins build image exists.
docker image inspect $sourceImage *> $null

if ($LASTEXITCODE -ne 0) {
    throw "Image $sourceImage does not exist."
}

# Create versioned release tag.
docker tag $sourceImage $releaseImage

if ($LASTEXITCODE -ne 0) {
    throw "Unable to create release tag."
}

# Make sure production volume exists.
docker volume inspect $productionVolume *> $null

if ($LASTEXITCODE -ne 0) {
    docker volume create $productionVolume | Out-Null
}

# Remove stale backup left by an older deployment.
if (Test-ContainerExists $backupContainer) {
    docker rm -f $backupContainer | Out-Null
}

$hadPreviousProduction = Test-ContainerExists $productionContainer

try {

    # Preserve current production for rollback.
    if ($hadPreviousProduction) {

        Write-Host "Preserving current production release..."

        docker stop $productionContainer | Out-Null

        if ($LASTEXITCODE -ne 0) {
            throw "Unable to stop existing production container."
        }

        docker rename $productionContainer $backupContainer

        if ($LASTEXITCODE -ne 0) {
            throw "Unable to preserve production container."
        }
    }

    Write-Host "Deploying $releaseVersion to production..."

    docker run -d `
        --name $productionContainer `
        --restart unless-stopped `
        -p 3000:3000 `
        -v "${productionVolume}:/app/data" `
        -e "JWT_SECRET=$env:PRODUCTION_JWT_SECRET" `
        -e "JWT_EXPIRES_IN=1h" `
        $releaseImage

    if ($LASTEXITCODE -ne 0) {
        throw "Unable to start new production container."
    }

    if (-not (Wait-ForHealthy $productionContainer)) {
        docker logs $productionContainer
        throw "New production release failed its health check."
    }

    Write-Host "Verifying production API..."

    $response = Invoke-RestMethod `
        -Uri "http://localhost:3000/health" `
        -Method Get

    if ($response.status -ne "healthy") {
        throw "Production health endpoint failed."
    }

    Write-Host "Production API is healthy."

    # Successful deployment: remove previous container.
    if (Test-ContainerExists $backupContainer) {
        docker rm $backupContainer | Out-Null
    }

    $releaseInfo = [ordered]@{
        version     = $releaseVersion
        image       = $releaseImage
        build       = $BuildNumber
        gitCommit   = $env:GIT_COMMIT
        environment = "production"
        status      = "released"
        releasedAt  = (Get-Date).ToUniversalTime().ToString("o")
    }

    $releaseInfo |
        ConvertTo-Json |
        Set-Content "release-info.json"

    Write-Host "RELEASE SUCCESSFUL: $releaseVersion"
}
catch {

    Write-Host "RELEASE FAILED: $($_.Exception.Message)"
    Write-Host "Starting automatic rollback..."

    if (Test-ContainerExists $productionContainer) {
        docker rm -f $productionContainer | Out-Null
    }

    if ($hadPreviousProduction -and (Test-ContainerExists $backupContainer)) {

        docker rename $backupContainer $productionContainer
        docker start $productionContainer | Out-Null

        if (Wait-ForHealthy $productionContainer) {
            Write-Host "ROLLBACK SUCCESSFUL - previous production restored."
        }
        else {
            Write-Host "ROLLBACK WARNING - previous release was restored but is unhealthy."
        }
    }
    else {
        Write-Host "No previous production release available for rollback."
    }

    throw
}