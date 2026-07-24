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
    }

    post {
        success {
            echo 'Build, Test, Code Quality and Security stages completed successfully.'
        }

        failure {
            echo 'Pipeline failed. Deployment is blocked.'
        }
    }
}