import {
  Span,
  TraceAPI,
  SpanStatusCode,
  ROOT_CONTEXT,
  Context,
  trace,
  SpanContext,
  Attributes,
} from "@opentelemetry/api";
import { BasicTracerProvider, Tracer } from "@opentelemetry/sdk-trace-base";
import * as core from "@actions/core";
import {
  WorkflowRunJobs,
  WorkflowRunJob,
  WorkflowRunJobStep,
  WorkflowArtifactLookup,
} from "../github";

import { traceWorkflowRunStep } from "./step";

export type TraceWorkflowRunJobsParams = {
  provider: BasicTracerProvider;
  workflowRunJobs: WorkflowRunJobs;
};

export async function traceWorkflowRunJobs({
  provider,
  workflowRunJobs,
}: TraceWorkflowRunJobsParams): Promise<SpanContext> {
  const tracer = provider.getTracer("otel-export-trace");

  const startTime = new Date(
    workflowRunJobs.workflowRun.run_started_at ||
      workflowRunJobs.workflowRun.created_at
  );
  let headRef: string | undefined = undefined;
  let baseRef: string | undefined = undefined;
  let baseSha: string | undefined = undefined;
  if (
    workflowRunJobs.workflowRun.pull_requests &&
    workflowRunJobs.workflowRun.pull_requests.length > 0
  ) {
    headRef = workflowRunJobs.workflowRun.pull_requests[0].head?.ref;
    baseRef = workflowRunJobs.workflowRun.pull_requests[0].base?.ref;
    baseSha = workflowRunJobs.workflowRun.pull_requests[0].base?.sha;
  }

  const attributes: Attributes = {
    "github.workflow_id": workflowRunJobs.workflowRun.workflow_id,
    "github.run_id": workflowRunJobs.workflowRun.id,
    "github.run_number": workflowRunJobs.workflowRun.run_number,
    "github.run_attempt": workflowRunJobs.workflowRun.run_attempt || 1,
    "github.html_url": workflowRunJobs.workflowRun.html_url,
    "github.workflow_url": workflowRunJobs.workflowRun.workflow_url,
    "github.event": workflowRunJobs.workflowRun.event,
    "github.workflow": workflowRunJobs.workflowRun.name || undefined,
    "github.conclusion": workflowRunJobs.workflowRun.conclusion || undefined,
    "github.created_at": workflowRunJobs.workflowRun.created_at,
    "github.updated_at": workflowRunJobs.workflowRun.updated_at,
    "github.run_started_at": workflowRunJobs.workflowRun.run_started_at,
    "github.author_name":
      workflowRunJobs.workflowRun.head_commit?.author?.name || undefined,
    "github.author_email":
      workflowRunJobs.workflowRun.head_commit?.author?.email || undefined,
    "github.head_sha": workflowRunJobs.workflowRun.head_sha,
    "github.head_ref": headRef,
    "github.base_ref": baseRef,
    "github.base_sha": baseSha,
    error: workflowRunJobs.workflowRun.conclusion === "failure",
  };

  if (core.getInput("additionalAttributes")) {
    const additionAttributes: unknown = JSON.parse(
      core.getInput("additionalAttributes")
    );
    Object.assign(attributes, additionAttributes);
  }

  const rootSpan = tracer.startSpan(
    workflowRunJobs.workflowRun.name ||
      `${workflowRunJobs.workflowRun.workflow_id}`,
    {
      attributes,
      root: true,
      startTime,
    },
    ROOT_CONTEXT
  );
  core.debug(`TraceID: ${rootSpan.spanContext().traceId}`);
  let code = SpanStatusCode.OK;
  if (workflowRunJobs.workflowRun.conclusion === "failure") {
    code = SpanStatusCode.ERROR;
  }
  rootSpan.setStatus({ code });
  core.debug(
    `Root Span: ${rootSpan.spanContext().traceId}: ${
      workflowRunJobs.workflowRun.created_at
    }`
  );

  try {
    if (workflowRunJobs.jobs.length > 0) {
      const firstJob = workflowRunJobs.jobs[0];
      const queueCtx = trace.setSpan(ROOT_CONTEXT, rootSpan);
      const queueSpan = tracer.startSpan("Queued", { startTime }, queueCtx);
      queueSpan.end(new Date(firstJob.started_at));
    }

    for (let i = 0; i < workflowRunJobs.jobs.length; i++) {
      const job = workflowRunJobs.jobs[i];
      await traceWorkflowRunJob({
        parentSpan: rootSpan,
        parentContext: ROOT_CONTEXT,
        trace,
        tracer,
        job,
        workflowArtifacts: workflowRunJobs.workflowRunArtifacts,
      });
    }
  } finally {
    rootSpan.end(new Date(workflowRunJobs.workflowRun.updated_at));
  }
  return rootSpan.spanContext();
}

type TraceWorkflowRunJobParams = {
  parentContext: Context;
  parentSpan: Span;
  trace: TraceAPI;
  tracer: Tracer;
  job: WorkflowRunJob;
  workflowArtifacts: WorkflowArtifactLookup;
};

async function traceWorkflowRunJob({
  parentContext,
  trace,
  parentSpan,
  tracer,
  job,
  workflowArtifacts,
}: TraceWorkflowRunJobParams) {
  core.debug(`Trace Job ${job.id}`);
  if (!job.completed_at) {
    console.warn(`Job ${job.id} is not completed yet`);
    return;
  }
  job.name;
  const ctx = trace.setSpan(parentContext, parentSpan);
  const startTime = new Date(job.started_at);
  const completedTime = new Date(job.completed_at);
  const span = tracer.startSpan(
    job.name,
    {
      attributes: {
        "github.job.id": job.id,
        "github.job.name": job.name,
        "github.job.run_id": job.run_id,
        "github.job.run_attempt": job.run_attempt || 1,
        "github.job.runner_group_id": job.runner_group_id || undefined,
        "github.job.runner_group_name": job.runner_group_name || undefined,
        "github.job.runner_name": job.runner_name || undefined,
        "github.job.conclusion": job.conclusion || undefined,
        "github.job.labels": job.labels.join(", ") || undefined,
        "github.job.started_at": job.started_at || undefined,
        "github.job.completed_at": job.completed_at || undefined,
        "github.conclusion": job.conclusion || undefined,
        error: job.conclusion === "failure",
      },
      startTime,
    },
    ctx
  );
  const spanId = span.spanContext().spanId;
  core.debug(`Job Span<${spanId}>: Started<${job.started_at}>`);

  try {
    let code = SpanStatusCode.OK;
    if (job.conclusion === "failure") {
      code = SpanStatusCode.ERROR;
    }
    span.setStatus({ code });
    const numSteps = job.steps?.length || 0;
    core.debug(`Trace ${numSteps} Steps`);
    if (job.steps !== undefined) {
      for (let i = 0; i < job.steps.length; i++) {
        const step: WorkflowRunJobStep = job.steps[i];
        await traceWorkflowRunStep({
          job,
          parentContext: ctx,
          trace,
          parentSpan: span,
          tracer,
          workflowArtifacts,
          step,
        });
      }
    }
  } finally {
    core.debug(`Job Span<${spanId}>: Ended<${job.completed_at}>`);
    // Some skipped and post jobs return completed_at dates that are older than started_at
    span.end(new Date(Math.max(startTime.getTime(), completedTime.getTime())));
  }
}
