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

| name         | description                                                                    | required | default           |
| ------------ | ------------------------------------------------------------------------------ | -------- | ----------------- |
| otlpEndpoint | The destination endpoint to export OpenTelemetry traces to                     | true     |                   |
| otlpHeaders  | Network Headers for the destination endpoint to export OpenTelemetry traces to | true     |                   |
| githubToken  | The repository token with Workflow permissions. Not required for public repos  | false    |                   |
| runId        | Workflow Run ID to Export                                                      | false    | env.GITHUB_RUN_ID |

### Action Outputs

| name    | description                               |
| ------- | ----------------------------------------- |
| traceId | The OpenTelemetry Trace ID for this Trace |

## Trace Unique Fields

| name                         | type    | description                                       |
| ---------------------------- | ------- | ------------------------------------------------- |
| name                         | string  | Workflow/Job/Step name                            |
| service.instance.id          | string  | {repo_full_name}/{workflow_id}/{run_id}/{run_num} |
| service.name                 | string  | Github Workflow Name                              |
| service.namespace            | string  | Github Repo Full Name                             |
| service.version              | string  | Github Workflow Run HEAD SHA                      |
| github.workflow_id           | integer | Github Workflow ID                                |
| github.workflow              | string  | Github Workflow Name                              |
| github.run_attempt           | integer | Github Workflow Run Attempt                       |
| github.run_id                | integer | Github Workflow Run ID                            |
| github.run_number            | integer | Github Workflow Run Number                        |
| github.html_url              | string  | Github Workflow Run HTML URL                      |
| github.author_email          | string  | Github Workflow Run Author Email                  |
| github.author_name           | string  | Github Workflow Run Author Name                   |
| github.conclusion            | string  | Github Workflow Run Conclusion                    |
| github.event                 | string  | Github Workflow Run Event Name                    |
| github.git_refs_url          | string  | Github Workflow Run refs url                      |
| github.head_sha              | string  | Github Workflow Run HEAD SHA                      |
| github.job.id                | float   | Github Job Run ID                                 |
| github.job.name              | string  | Github Job Run Name                               |
| github.job.started_at        | string  | Github Job Run started_at                         |
| github.job.completed_at      | string  | Github Job Run completed_at                       |
| github.job.conclusion        | string  | Github Job Run Conclusion                         |
| github.job.labels            | string  | Github Job Run Labels. Comma separated values     |
| github.job.run_attempt       | integer | Github Job Run Run Attempt                        |
| github.job.run_id            | integer | Github Job Run Run ID                             |
| github.job.runner_group_id   | integer | Github Job Runner Group ID                        |
| github.job.runner_group_name | string  | Github Job Runner Group Name                      |
| github.job.runner_name       | string  | Github Job Runner Name                            |
| github.job.step.conclusion   | string  | Github Step Run Conclusion                        |
| github.job.step.name         | string  | Github Step Run Name                              |
| github.job.step.number       | integer | Github Step Run Number                            |
| github.job.step.started_at   | string  | Github Step Run started_at                        |
| github.job.step.completed_at | string  | Github Step Run completed_at                      |

## Honeycomb Example Trace

![HoneyComb Example](./docs/honeycomb-example.png)

_with junit traces_
![HoneyComb Junit Example](./docs/honeycomb-junit-example.png)
