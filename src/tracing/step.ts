import * as core from "@actions/core";
import {
  TraceAPI,
  Context,
  SpanStatusCode,
  Span,
  Attributes,
} from "@opentelemetry/api";
import { Tracer } from "@opentelemetry/sdk-trace-base";
import {
  WorkflowRunJobStep,
  WorkflowRunJob,
  WorkflowArtifactLookup,
} from "../github";
import { traceOTLPFile } from "./trace-otlp-file";

export type TraceWorkflowRunStepParams = {
  job: WorkflowRunJob;
  trace: TraceAPI;
  parentSpan: Span;
  parentContext: Context;
  tracer: Tracer;
  workflowArtifacts: WorkflowArtifactLookup;
  step?: WorkflowRunJobStep;
  workflowAttributes: Attributes;
  jobAttributes: Attributes;
};

export async function traceWorkflowRunStep({
  job,
  parentContext,
  parentSpan,
  trace,
  tracer,
  workflowArtifacts,
  step,
  workflowAttributes,
  jobAttributes,
}: TraceWorkflowRunStepParams) {
  if (!step || !step.completed_at || !step.started_at) {
    const stepName = step?.name || "UNDEFINED";
    console.warn(`Step ${stepName} is not completed yet.`);
    return;
  }
  if (step.conclusion == "cancelled" || step.conclusion == "skipped") {
    console.info(`Step ${step.name} did not run.`);
    return;
  }
  core.debug(`Trace Step ${step.name}`);
  const ctx = trace.setSpan(parentContext, parentSpan);
  const startTime = new Date(step.started_at);
  const completedTime = new Date(step.completed_at);
  const span = tracer.startSpan(
    step.name,
    {
      attributes: {
        ...workflowAttributes,
        ...jobAttributes,
        "github.job.step.name": step.name,
        "github.job.step.number": step.number,
        "github.job.step.started_at": step.started_at || undefined,
        "github.job.step.completed_at": step.completed_at || undefined,
        "github.job.step.id": step.id,
        error: step.conclusion === "failure",
      },
      startTime,
    },
    ctx
  );
  const spanId = span.spanContext().spanId;
  try {
    span.setStatus({ code: SpanStatusCode.ERROR });
    if (step.conclusion !== "failure") {
      span.setStatus({ code: SpanStatusCode.OK });
    }
    core.debug(`Step Span<${spanId}>: Started<${step.started_at}>`);
    if (step.conclusion) {
      span.setAttribute("github.job.step.conclusion", step.conclusion);
    }
    await traceArtifact({
      tracer,
      parentSpan: span,
      job,
      step,
      startTime,
      workflowArtifacts,
    });
  } finally {
    core.debug(`Step Span<${spanId}>: Ended<${step.completed_at}>`);
    // Some skipped and post jobs return completed_at dates that are older than started_at
    span.end(new Date(Math.max(startTime.getTime(), completedTime.getTime())));
  }
}

type TraceArtifactParams = {
  tracer: Tracer;
  parentSpan: Span;
  job: WorkflowRunJob;
  step: WorkflowRunJobStep;
  startTime: Date;
  workflowArtifacts: WorkflowArtifactLookup;
};

async function traceArtifact({
  tracer,
  parentSpan,
  job,
  step,
  startTime,
  workflowArtifacts,
}: TraceArtifactParams) {
  const artifact = workflowArtifacts(job.name, step.name);
  if (artifact) {
    core.debug(`Found Artifact ${artifact?.path}`);
    await traceOTLPFile({
      tracer,
      parentSpan,
      startTime,
      path: artifact.path,
    });
  } else {
    core.debug(`No Artifact to trace for Job<${job.name}> Step<${step.name}>`);
  }
}
