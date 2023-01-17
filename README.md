# Open Telemetry Trace Exporter Action

This action will export GitHub Workflow telemetry data using OTLP to a configurable endpoint.

## Usage

### On workflow_run Event

```yaml
name: OpenTelemetry Export Trace

on:
  workflow_run:
    workflows: [my-workflow]
    types: [completed]

jobs:
  otel-export-trace:
    name: OpenTelemetry Export Trace
    runs-on: ubuntu-latest
    steps:
      - name: Export Workflow Trace
        uses: inception-health/otel-export-trace-action@latest
        with:
          otlpEndpoint: grpc://api.honeycomb.io:443/
          otlpHeaders: ${{ secrets.OTLP_HEADERS }}
          githubToken: ${{ secrets.GITHUB_TOKEN }}
          runId: ${{ github.event.workflow_run.id }}
```

### On Current Workflow

```yaml
name: OpenTelemetry Export Trace

on:
  push:
    branch: [main]

jobs:
  build:
    # Run build steps
  otel-export-trace:
    if: always()
    name: OpenTelemetry Export Trace
    runs-on: ubuntu-latest
    needs: [build] # must run when all jobs are complete
    steps:
      - name: Export Workflow Trace
        uses: inception-health/otel-export-trace-action@latest
        with:
          otlpEndpoint: grpc://api.honeycomb.io:443/
          otlpHeaders: ${{ secrets.OTLP_HEADERS }}
          githubToken: ${{ secrets.GITHUB_TOKEN }}
```

### With Junit Tracing

Combined with [OpenTelemetry Upload Trace Artifact](https://github.com/marketplace/actions/opentelemetry-upload-trace-artifact) this action will Download the OTLP Trace Log Artifact uploaded from the Workflow Run and export it.

_pr-workflow.yml_

```yaml
name: "PR check"

on:
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - name: Install Dependencies
        run: npm ci --ignore-scripts
      - name: run tests
        run: npm run test:ci
      - uses: inception-health/otel-upload-test-artifact-action@v1
        if: always()
        with:
          jobName: "build-and-test"
          stepName: "run tests"
          path: "junit.xml"
          type: "junit"
          githubToken: ${{ secrets.GITHUB_TOKEN }}
```

_otel-export-trace.yml_

```yaml
name: OpenTelemetry Export Trace

on:
  workflow_run:
    workflows: ["PR check"]
    types: [completed]

jobs:
  otel-export-trace:
    name: OpenTelemetry Export Trace
    runs-on: ubuntu-latest
    steps:
      - name: Export Workflow Trace
        uses: inception-health/otel-export-trace-action@latest
        with:
          otlpEndpoint: grpc://api.honeycomb.io:443/
          otlpHeaders: ${{ secrets.OTLP_HEADERS }}
          githubToken: ${{ secrets.GITHUB_TOKEN }}
          runId: ${{ github.event.workflow_run.id }}
```

### Action Inputs

| name            | description                                                                                                                                          | required | default           |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------- |
| otlpEndpoint    | The destination endpoint to export OpenTelemetry traces to                                                                                           | true     |                   |
| otlpHeaders     | Network Headers for the destination endpoint to export OpenTelemetry traces to. Ex. `x-honeycomb-team=YOUR_API_KEY,x-honeycomb-dataset=YOUR_DATASET` | true     |                   |
| otelServiceName | OpenTelemetry service name                                                                                                                           | false    |                   |
| githubToken     | The repository token with Workflow permissions. Not required for public repos                                                                        | false    |                   |
| runId           | Workflow Run ID to Export                                                                                                                            | false    | env.GITHUB_RUN_ID |

### Action Outputs

| name    | description                               |
| ------- | ----------------------------------------- |
| traceId | The OpenTelemetry Trace ID for this Trace |

## Trace Unique Fields

| name                         | type    | description                                       |
| ---------------------------- | ------- | ------------------------------------------------- |
| name                         | string  | Workflow/Job/Step name                            |
| service.instance.id          | string  | {repo_full_name}/{workflow_id}/{run_id}/{run_num} |
| service.name                 | string  | GitHub Workflow Name                              |
| service.namespace            | string  | GitHub Repo Full Name                             |
| service.version              | string  | GitHub Workflow Run HEAD SHA                      |
| github.workflow_id           | integer | GitHub Workflow ID                                |
| github.workflow              | string  | GitHub Workflow Name                              |
| github.workflow_url          | string  | GitHub Workflow URL                               |
| github.run_attempt           | integer | GitHub Workflow Run Attempt                       |
| github.run_id                | integer | GitHub Workflow Run ID                            |
| github.run_number            | integer | GitHub Workflow Run Number                        |
| github.created_at            | integer | GitHub Workflow Run Created Timestamp             |
| github.updated_at            | integer | GitHub Workflow Run Updated Timestamp             |
| github.run_started_at        | integer | GitHub Workflow Run Started Timestamp             |
| github.html_url              | string  | GitHub Workflow Run HTML URL                      |
| github.author_email          | string  | GitHub Workflow Run Author Email                  |
| github.author_name           | string  | GitHub Workflow Run Author Name                   |
| github.conclusion            | string  | GitHub Workflow Run Conclusion                    |
| github.event                 | string  | GitHub Workflow Run Event Name                    |
| github.git_refs_url          | string  | GitHub Workflow Run refs URL                      |
| github.head_sha              | string  | GitHub Workflow Run HEAD SHA                      |
| github.job.id                | float   | GitHub Job ID                                     |
| github.job.name              | string  | GitHub Job Run Name                               |
| github.job.started_at        | string  | GitHub Job Run started_at                         |
| github.job.completed_at      | string  | GitHub Job Run completed_at                       |
| github.job.conclusion        | string  | GitHub Job Run Conclusion                         |
| github.job.labels            | string  | GitHub Job Run Labels. Comma separated values     |
| github.job.run_attempt       | integer | GitHub Job Run Run Attempt                        |
| github.job.run_id            | integer | GitHub Job Run ID                                 |
| github.job.runner_group_id   | integer | GitHub Job Runner Group ID                        |
| github.job.runner_group_name | string  | GitHub Job Runner Group Name                      |
| github.job.runner_name       | string  | GitHub Job Runner Name                            |
| github.job.step.conclusion   | string  | GitHub Step Run Conclusion                        |
| github.job.step.id           | string  | GitHub Step ID                                    |
| github.job.step.name         | string  | GitHub Step Name                                  |
| github.job.step.number       | integer | GitHub Step Run Number                            |
| github.job.step.started_at   | string  | GitHub Step Run started_at                        |
| github.job.step.completed_at | string  | GitHub Step Run completed_at                      |

## Honeycomb Example Trace

![HoneyComb Example](./docs/honeycomb-example.png)

_with junit traces_
![HoneyComb Junit Example](./docs/honeycomb-junit-example.png)
