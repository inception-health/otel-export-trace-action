import * as grpc from "@grpc/grpc-js";
import {
  BasicTracerProvider,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import {
  ContextAPI,
  Span,
  SpanAttributeValue,
  TraceAPI,
  Tracer,
} from "@opentelemetry/api";

import {
  WorkflowRunJobs,
  WorkflowRunJob,
  WorkflowRunJobStep,
  WorkflowArtifactMap,
  WorkflowArtifact,
} from "./github";
import { Resource } from "@opentelemetry/resources";

type StringDict = { [key: string]: string };

function stringToHeader(value: string): StringDict {
  const pairs = value.split(",");
  return pairs.reduce((result, item) => {
    const [key, value] = item.split("=");
    return {
      ...result,
      [key.trim()]: value.trim(),
    };
  }, {});
}

const workflowStepArtifactName = (job: number, step: string) =>
  `${job}-${step}.traces`;

export function createTracerProvider(
  otlpEndpoint: string,
  otlpHeaders: string,
  workflowRunJobs: WorkflowRunJobs
) {
  const serviceName =
    workflowRunJobs.workflowRun.name ||
    `${workflowRunJobs.workflowRun.workflow_id}`;
  const serviceInstanceId = [
    workflowRunJobs.workflowRun.repository.full_name,
    workflowRunJobs.workflowRun.workflow_id,
    workflowRunJobs.workflowRun.id,
    workflowRunJobs.workflowRun.run_attempt,
  ].join("/");
  const serviceNamespace = workflowRunJobs.workflowRun.repository.full_name;
  const serviceVersion = workflowRunJobs.workflowRun.head_sha;

  const provider = new BasicTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: serviceInstanceId,
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: serviceNamespace,
      [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
    }),
  });

  const credentials = otlpEndpoint ? grpc.credentials.createSsl() : undefined;

  provider.addSpanProcessor(
    new SimpleSpanProcessor(
      new OTLPTraceExporter({
        url: otlpEndpoint,
        credentials,
        metadata: grpc.Metadata.fromHttp2Headers(stringToHeader(otlpHeaders)),
      })
    )
  );
  provider.register();

  return provider;
}

export function traceWorkflowRunJobs(
  context: ContextAPI,
  trace: TraceAPI,
  workflowRunJobs: WorkflowRunJobs
): void {
  const attributes: { [key: string]: SpanAttributeValue } = {
    "github.workflow_id": workflowRunJobs.workflowRun.workflow_id,
    "github.run_id": workflowRunJobs.workflowRun.id,
    "github.run_number": workflowRunJobs.workflowRun.run_number,
    "github.run_attempt": workflowRunJobs.workflowRun.run_attempt || 1,
    "github.html_url": workflowRunJobs.workflowRun.html_url,
    "github.event": workflowRunJobs.workflowRun.event,
    "github.head_sha": workflowRunJobs.workflowRun.head_sha,
    "github.git_refs_url": workflowRunJobs.workflowRun.repository.git_refs_url,
    error: false,
  };

  if (workflowRunJobs.workflowRun.name) {
    attributes["github.workflow"] = workflowRunJobs.workflowRun.name;
  }
  if (workflowRunJobs.workflowRun.conclusion) {
    attributes["github.conclusion"] = workflowRunJobs.workflowRun.conclusion;
    attributes["error"] = workflowRunJobs.workflowRun.conclusion === "failure";
  }
  if (workflowRunJobs.workflowRun.head_commit?.author) {
    attributes["github.author_name"] =
      workflowRunJobs.workflowRun.head_commit.author.name;
    attributes["github.author_email"] =
      workflowRunJobs.workflowRun.head_commit.author.email;
  }
  if (
    workflowRunJobs.workflowRun.pull_requests &&
    workflowRunJobs.workflowRun.pull_requests.length > 0
  ) {
    attributes["github.head_ref"] =
      workflowRunJobs.workflowRun.pull_requests[0].head.ref;
    attributes["github.base_ref"] =
      workflowRunJobs.workflowRun.pull_requests[0].base.ref;
  }

  const tracer = trace.getTracer("otel-export-trace");
  const startTime = new Date(workflowRunJobs.workflowRun.created_at);

  const rootSpan = tracer.startSpan(
    workflowRunJobs.workflowRun.name ||
      `${workflowRunJobs.workflowRun.workflow_id}`,
    {
      attributes,
      root: true,
      startTime,
    }
  );

  console.log(
    `Root Span: ${rootSpan.spanContext().traceId}: ${
      workflowRunJobs.workflowRun.created_at
    }`
  );

  try {
    workflowRunJobs.jobs.forEach((job) => {
      traceWorkflowRunJob(
        context,
        trace,
        rootSpan,
        tracer,
        job,
        workflowRunJobs.workflowRunArtifacts
      );
    });
  } finally {
    rootSpan.end(new Date(workflowRunJobs.workflowRun.updated_at));
  }
}

function traceWorkflowRunJob(
  context: ContextAPI,
  trace: TraceAPI,
  rootSpan: Span,
  tracer: Tracer,
  job: WorkflowRunJob,
  workflowArtifacts: WorkflowArtifactMap
) {
  console.log(`Trace Job ${job.id}`);
  if (!job.completed_at) {
    console.warn(`Job ${job.id} is not completed yet`);
    return;
  }

  const jobContext = trace.setSpan(context.active(), rootSpan);
  const startTime = new Date(job.started_at);
  const jobSpan = tracer.startSpan(
    job.name,
    {
      attributes: {
        "github.job.id": job.id,
        "github.job.name": job.name,
        "github.job.run_id": job.run_id,
        "github.job.run_attempt": job.run_attempt || 1,
      },
      startTime,
    },
    jobContext
  );
  console.log(`Job Span: ${jobSpan.spanContext().spanId}: ${job.started_at}`);
  if (job.runner_group_id) {
    jobSpan.setAttribute("github.job.runner_group_id", job.runner_group_id);
  }
  if (job.runner_group_name) {
    jobSpan.setAttribute("github.job.runner_group_name", job.runner_group_name);
  }
  if (job.runner_name) {
    jobSpan.setAttribute("github.job.runner_name", job.runner_name);
  }
  if (job.conclusion) {
    jobSpan.setAttribute("github.job.conclusion", job.conclusion);
  }
  if (job.labels.length > 0) {
    jobSpan.setAttribute("github.job.labels", job.labels.join(", "));
  }
  try {
    const numSteps = job.steps?.length || 0;
    console.log(`Trace ${numSteps} Steps`);
    job.steps?.forEach((step?: WorkflowRunJobStep) => {
      traceWorkflowRunStep(
        job.id,
        context,
        trace,
        jobSpan,
        tracer,
        workflowArtifacts,
        step
      );
    });
  } finally {
    const completedAt: string = job.completed_at;
    jobSpan.end(new Date(completedAt));
  }
}

function traceWorkflowRunStep(
  jobId: number,
  context: ContextAPI,
  trace: TraceAPI,
  jobSpan: Span,
  tracer: Tracer,
  workflowArtifacts: WorkflowArtifactMap,
  step?: WorkflowRunJobStep
) {
  if (!step || !step.completed_at || !step.started_at) {
    const stepName = step?.name || "UNDEFINED";
    console.warn(`Step ${stepName} is not completed yet`);
    return;
  }
  console.log(`Trace Step ${step.name}`);
  const stepContext = trace.setSpan(context.active(), jobSpan);
  const startTime = new Date(step.started_at);
  const stepSpan = tracer.startSpan(
    step.name,
    {
      attributes: {
        "github.job.step.name": step.name,
        "github.job.step.number": step.number,
      },
      startTime,
    },
    stepContext
  );
  try {
    console.log(
      `Job Span: ${stepSpan.spanContext().spanId}: ${step.started_at}`
    );
    if (step.conclusion) {
      stepSpan.setAttribute("github.job.step.conclusion", step.conclusion);
    }

    const workflowArtifactName = workflowStepArtifactName(jobId, step.name);
    const workflowArtifact: WorkflowArtifact | undefined =
      workflowArtifacts[workflowArtifactName];

    console.log(workflowArtifact.id);
  } finally {
    stepSpan.end(new Date(step.completed_at));
  }
}
