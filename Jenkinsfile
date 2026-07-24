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
            }
        }

        stage('Quality Gate') {
            steps {
                echo '===== SONARQUBE QUALITY GATE ====='

                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }
    }

    post {
        success {
            echo 'Build, Test and Code Quality stages completed successfully.'
        }

        failure {
            echo 'Pipeline failed. Deployment is blocked.'
        }
    }
}