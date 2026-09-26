# SIT753 Task Manager DevOps Pipeline

This repository contains a production-style Task Management REST API and
a fully automated seven-stage DevOps pipeline implemented with Jenkins
for SIT753.

The project demonstrates continuous integration, automated testing, code
quality analysis, security scanning, staged deployment, production
release, rollback support, monitoring, and alerting.

## Project overview

The application is a Node.js REST API for task management. It includes:

-   User registration and login
-   bcrypt password hashing
-   JWT authentication
-   Protected task CRUD operations
-   User-level task isolation
-   SQLite persistence
-   Health checks
-   Prometheus metrics
-   Docker containerisation

The application is organised into routes, controllers, middleware,
database, and monitoring components so that it can be tested, deployed,
secured, and monitored through an automated CI/CD workflow.

## Technology stack

  Area               Technologies
  ------------------ -----------------------
  Application        Node.js 22, Express
  Database           SQLite
  Authentication     JWT, bcrypt
  Testing            Jest, Supertest
  Containerisation   Docker
  CI/CD              Jenkins
  Code quality       SonarQube
  Security           npm audit, Trivy
  Monitoring         Prometheus, Grafana
  Alerting           Alertmanager, Discord

## CI/CD pipeline

The Jenkins pipeline contains seven DevOps stages:

1.  Build
2.  Test
3.  Code Quality
4.  Security
5.  Deploy
6.  Release
7.  Monitoring

The pipeline follows a fail-fast design. A failed test, coverage
threshold, SonarQube Quality Gate, security gate, deployment health
check, release health check, or monitoring verification prevents the
pipeline from continuing successfully.

### 1. Build

The Build stage:

-   Checks out the current source revision
-   Displays the Node.js and npm versions
-   Installs dependencies using `npm ci`
-   Verifies Docker connectivity
-   Builds the production Docker image
-   Tags the image using the Jenkins build number
-   Adds the `latest` tag

Example image tags:

``` text
task-manager-api:20
task-manager-api:latest
```

The Docker image runs the application as the non-root `node` user and
includes a health check against `/health`.

### 2. Test

The Test stage uses Jest and Supertest.

It includes:

-   Unit tests for JWT authentication middleware
-   Integration tests for health checks
-   Registration and login tests
-   Validation and error-path tests
-   Authenticated task CRUD tests
-   Cross-user task isolation tests
-   Coverage reporting

The test suite contains 30 tests. Jenkins enforces global coverage
thresholds of at least 80% for statements, branches, functions, and
lines.

Run the test suites locally with:

``` bash
npm run test:unit
npm run test:integration
npm run test:coverage
```

### 3. Code Quality

SonarQube performs static code analysis using the Sonar scanner.

The Quality Gate includes:

-   Overall coverage of at least 80%
-   Duplicated lines of no more than 3%
-   Sonar Way new-code conditions

Jenkins waits for the SonarQube Quality Gate result before allowing the
pipeline to continue.

### 4. Security

The Security stage combines dependency and container-image scanning.

`npm audit` checks Node.js dependencies for HIGH and CRITICAL
vulnerabilities.

Trivy scans the Docker image created by the current Jenkins build. The
pipeline archives a full security report and also performs a blocking
scan for fixable HIGH and CRITICAL vulnerabilities.

The production image is hardened by:

-   Using a slim Node.js base image
-   Installing only production dependencies in the runtime image
-   Removing unnecessary npm/npx runtime components
-   Running as a non-root user
-   Limiting exposed services
-   Rebuilding and rescanning the image on CI runs

### 5. Deploy

The Deploy stage automatically deploys the verified image to a staging
environment.

Staging configuration:

``` text
Container: task-manager-staging
Host port: 3001
Application port: 3000
```

Jenkins waits for the Docker health check and then independently
verifies the `/health` endpoint. Only a healthy staging deployment can
continue to the Release stage.

### 6. Release

The Release stage promotes the verified image to production.

Production configuration:

``` text
Container: task-manager-production
Host port: 3000
Release tag: 1.0.<BUILD_NUMBER>
```

The release process records release metadata and implements automatic
rollback.

Before replacing production, the current production container is
preserved as a backup. If the new release fails its startup or health
verification, Jenkins removes the failed release and restores the
previous production container.

### 7. Monitoring

The application exposes Prometheus-compatible metrics through
`/metrics`.

The monitoring stack contains:

-   Prometheus for metric collection
-   Grafana for dashboards
-   Alertmanager for alert routing
-   Discord for operational notifications

Grafana visualises production availability, request rate, p95 latency,
and 5xx error rate.

Three production alert rules are configured:

  -----------------------------------------------------------------------
  Alert                               Condition
  ----------------------------------- -----------------------------------
  ProductionAPIDown                   Production target unavailable for
                                      20 seconds

  ProductionHighErrorRate             5xx responses exceed 10% for one
                                      minute

  ProductionHighLatency               p95 latency exceeds one second for
                                      one minute
  -----------------------------------------------------------------------

The monitoring configuration is stored in
`monitoring/docker-compose.yml` and related configuration files so that
the monitoring environment is reproducible.

## Pipeline flow

``` text
Git repository
      |
      v
    Build
      |
      v
     Test
      |
      v
 Code Quality
      |
      v
   Security
      |
      v
    Deploy
   Staging
      |
      v
   Release
 Production
      |
      v
 Monitoring
      |
      +--> Prometheus
      +--> Grafana
      +--> Alertmanager
               |
               v
             Discord
```

## Running the project

Install the project dependencies:

``` bash
npm ci
```

Run the automated tests:

``` bash
npm run test:unit
npm run test:integration
npm run test:coverage
```

Build the production Docker image:

``` bash
docker build -t task-manager-api:local .
```

The application exposes port 3000 inside the container and provides:

``` text
/health
/metrics
/api/tasks
```

Authentication is required for protected task operations.

## Monitoring stack

The monitoring infrastructure is defined with Docker Compose.

Validate the monitoring configuration:

``` bash
docker compose -f monitoring/docker-compose.yml config
```

Start or update the monitoring services:

``` bash
docker compose -f monitoring/docker-compose.yml up -d
```

Default monitoring ports used by this project:

  Service          Port
  -------------- ------
  Prometheus       9090
  Grafana          3002
  Alertmanager     9093

## Jenkins setup

The repository contains the `Jenkinsfile` used to define the complete
pipeline.

A Jenkins environment running this project requires access to:

-   Git
-   Node.js and npm
-   Docker
-   SonarQube
-   The credentials required by the pipeline

Sensitive values such as SonarQube tokens, staging and production JWT
secrets, and the Discord webhook are stored in Jenkins Credentials
rather than committed to source control.

## Repository structure

``` text
.
├── src/                     Application source code
├── tests/                   Unit and integration tests
├── monitoring/              Prometheus, Grafana and Alertmanager configuration
├── Dockerfile               Production container definition
├── Jenkinsfile              Seven-stage CI/CD pipeline
├── sonar-project.properties SonarQube project configuration
├── package.json             Node.js dependencies and scripts
└── README.md                Project documentation
```

## Pipeline outcome

The completed pipeline demonstrates an automated path from source
control to verified production operation:

``` text
Source -> Build -> Test -> Quality -> Security -> Staging -> Production -> Monitoring
```

Quality and security gates are intentionally enforced rather than
bypassed. When a gate fails, the implementation is corrected before the
pipeline is allowed to proceed.
