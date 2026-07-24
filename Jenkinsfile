pipeline {
    agent any

    environment {
        IMAGE_NAME = 'task-manager-api'
    }

    stages {

        stage('Build') {
            steps {
                echo '===== BUILD STAGE ====='

                bat 'node --version'
                bat 'npm --version'
                bat 'npm ci'

                bat 'docker version'

                bat 'docker build -t %IMAGE_NAME%:%BUILD_NUMBER% .'
                bat 'docker tag %IMAGE_NAME%:%BUILD_NUMBER% %IMAGE_NAME%:latest'
            }
        }

        stage('Test') {
            steps {
                echo '===== TEST STAGE ====='

                bat 'npm run test:unit'
                bat 'npm run test:integration'
                bat 'npm run test:coverage'
            }

            post {
                always {
                    archiveArtifacts artifacts: 'coverage/**',
                                     allowEmptyArchive: true
                }
            }
        }

        stage('Code Quality') {
            steps {
                echo '===== CODE QUALITY STAGE ====='

                withSonarQubeEnv('Local SonarQube') {
                    bat '''
                        set SONAR_TOKEN=%SONAR_AUTH_TOKEN%
                        npx @sonar/scan
                    '''
                }

                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Security') {
            steps {
                echo '===== SECURITY STAGE ====='

                bat '''
                    if exist security-reports rmdir /s /q security-reports
                    mkdir security-reports
                '''

                echo 'Checking npm dependencies for HIGH/CRITICAL vulnerabilities...'

                bat 'npm audit --audit-level=high'

                bat '''
                    npm audit --json --audit-level=high > security-reports\\npm-audit.json
                '''

                echo 'Generating full Trivy vulnerability report...'

                bat '''
                    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:0.72.0 image --scanners vuln --severity HIGH,CRITICAL --exit-code 0 %IMAGE_NAME%:%BUILD_NUMBER% > security-reports\\trivy-full.txt
                '''

                echo 'Applying Trivy blocking security gate...'

                bat '''
                    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:0.72.0 image --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 %IMAGE_NAME%:%BUILD_NUMBER% > security-reports\\trivy-gate.txt
                    set TRIVY_EXIT=%ERRORLEVEL%
                    type security-reports\\trivy-gate.txt
                    exit /b %TRIVY_EXIT%
                '''
            }

            post {
                always {
                    archiveArtifacts artifacts: 'security-reports/**',
                                     allowEmptyArchive: true
                }
            }
        }

        stage('Deploy') {
            steps {
                echo '===== DEPLOY STAGE - STAGING ====='

                withCredentials([
                    string(
                        credentialsId: 'staging-jwt-secret',
                        variable: 'STAGING_JWT_SECRET'
                    )
                ]) {
                    bat '''
                        @echo off

                        echo Preparing staging environment...

                        docker rm -f task-manager-staging >nul 2>&1

                        docker volume inspect task-manager-staging-data >nul 2>&1 || docker volume create task-manager-staging-data

                        echo Deploying build %BUILD_NUMBER% to staging...

                        docker run -d ^
                            --name task-manager-staging ^
                            --restart unless-stopped ^
                            -p 3001:3000 ^
                            -v task-manager-staging-data:/app/data ^
                            -e JWT_SECRET=%STAGING_JWT_SECRET% ^
                            -e JWT_EXPIRES_IN=1h ^
                            %IMAGE_NAME%:%BUILD_NUMBER%
                    '''
                }

                echo 'Waiting for staging container health check...'

                powershell '''
                    $maxAttempts = 12

                    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {

                        $health = docker inspect `
                            --format='{{.State.Health.Status}}' `
                            task-manager-staging 2>$null

                        Write-Host "Health check $attempt/$maxAttempts : $health"

                        if ($health -eq 'healthy') {
                            Write-Host 'Staging container is healthy.'
                            exit 0
                        }

                        if ($health -eq 'unhealthy') {
                            Write-Host 'Staging container became unhealthy.'
                            docker logs task-manager-staging
                            exit 1
                        }

                        Start-Sleep -Seconds 5
                    }

                    Write-Host 'Staging health check timed out.'
                    docker logs task-manager-staging
                    exit 1
                '''

                echo 'Verifying staging API...'

                powershell '''
                    $response = Invoke-RestMethod `
                        -Uri 'http://localhost:3001/health' `
                        -Method Get

                    $response | ConvertTo-Json

                    if ($response.status -ne 'healthy') {
                        throw 'Staging API health endpoint failed.'
                    }

                    Write-Host 'Staging deployment verified successfully.'
                '''
            }
        }

        stage('Release') {
            steps {
                echo '===== RELEASE STAGE - PRODUCTION ====='

                withCredentials([
                    string(
                        credentialsId: 'production-jwt-secret',
                        variable: 'PRODUCTION_JWT_SECRET'
                    )
                ]) {
                    powershell '''
                        .\\scripts\\release-production.ps1 `
                            -ImageName "$env:IMAGE_NAME" `
                            -BuildNumber "$env:BUILD_NUMBER"
                    '''
                }
            }

            post {
                always {
                    archiveArtifacts artifacts: 'release-info.json',
                                     allowEmptyArchive: true
                }
            }
        }

        stage('Monitoring') {
            steps {
                echo '===== MONITORING STAGE ====='

                echo 'Starting / updating monitoring infrastructure...'

		bat '''
   		 "C:\\Users\\admin\\AppData\\Local\\Programs\\DockerDesktop\\resources\\cli-plugins\\docker-compose.exe" -f monitoring\\docker-compose.yml config

  		"C:\\Users\\admin\\AppData\\Local\\Programs\\DockerDesktop\\resources\\cli-plugins\\docker-compose.exe" -f monitoring\\docker-compose.yml up -d
		'''

                echo 'Verifying monitoring services and production target...'

                powershell '''
                    $ErrorActionPreference = "Stop"

                    Write-Host "Waiting for Prometheus..."

                    $prometheusReady = $false

                    for ($attempt = 1; $attempt -le 12; $attempt++) {
                        try {
                            $response = Invoke-WebRequest `
                                -Uri "http://localhost:9090/-/ready" `
                                -UseBasicParsing `
                                -TimeoutSec 5

                            if ($response.StatusCode -eq 200) {
                                $prometheusReady = $true
                                break
                            }
                        }
                        catch {
                            Write-Host "Prometheus not ready yet..."
                        }

                        Start-Sleep -Seconds 5
                    }

                    if (-not $prometheusReady) {
                        throw "Prometheus did not become ready."
                    }

                    Write-Host "Prometheus is ready."

                    $productionUp = $false

                    for ($attempt = 1; $attempt -le 12; $attempt++) {

                        $query = [uri]::EscapeDataString(
                            'up{job="task-manager-production"}'
                        )

                        $result = Invoke-RestMethod `
                            -Uri "http://localhost:9090/api/v1/query?query=$query"

                        if (
                            $result.status -eq "success" -and
                            $result.data.result.Count -gt 0
                        ) {
                            $value = [double]$result.data.result[0].value[1]

                            Write-Host "Production Prometheus UP metric: $value"

                            if ($value -eq 1) {
                                $productionUp = $true
                                break
                            }
                        }

                        Start-Sleep -Seconds 5
                    }

                    if (-not $productionUp) {
                        throw "Prometheus reports production API as DOWN."
                    }

                    Write-Host "Production target is UP in Prometheus."

                    $rules = Invoke-RestMethod `
                        -Uri "http://localhost:9090/api/v1/rules"

                    $ruleNames = @(
                        $rules.data.groups.rules |
                        ForEach-Object { $_.name }
                    )

                    if ($ruleNames -notcontains "ProductionAPIDown") {
                        throw "ProductionAPIDown alert rule was not loaded."
                    }

                    Write-Host "ProductionAPIDown alert rule is loaded."

                    $alertmanager = Invoke-WebRequest `
                        -Uri "http://localhost:9093/-/ready" `
                        -UseBasicParsing

                    if ($alertmanager.StatusCode -ne 200) {
                        throw "Alertmanager is not ready."
                    }

                    Write-Host "Alertmanager is ready."
                    Write-Host "Monitoring verification completed successfully."
                '''
            }
        }

    }

    post {
        success {
            echo 'All 7 DevOps pipeline stages completed successfully.'
        }

        failure {
            echo 'Pipeline failed. Subsequent stages are blocked.'
        }
    }
}