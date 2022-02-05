import {
  Span,
  TraceAPI,
  SpanStatusCode,
  ROOT_CONTEXT,
  Context,
  trace,
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
}: TraceWorkflowRunJobsParams) {
  const tracer = provider.getTracer("otel-export-trace");

  const startTime = new Date(workflowRunJobs.workflowRun.created_at);

  const rootSpan = tracer.startSpan(
    workflowRunJobs.workflowRun.name ||
      `${workflowRunJobs.workflowRun.workflow_id}`,
    {
      attributes: {
        "github.workflow_id": workflowRunJobs.workflowRun.workflow_id,
        "github.run_id": workflowRunJobs.workflowRun.id,
        "github.run_number": workflowRunJobs.workflowRun.run_number,
        "github.run_attempt": workflowRunJobs.workflowRun.run_attempt || 1,
        "github.html_url": workflowRunJobs.workflowRun.html_url,
        "github.event": workflowRunJobs.workflowRun.event,
        "github.workflow": workflowRunJobs.workflowRun.name || undefined,
        "github.conclusion":
          workflowRunJobs.workflowRun.conclusion || undefined,
        "github.author_name":
          workflowRunJobs.workflowRun.head_commit?.author?.name || undefined,
        "github.author_email":
          workflowRunJobs.workflowRun.head_commit?.author?.email || undefined,
        "github.head_sha": workflowRunJobs.workflowRun.head_sha,
        "github.head_ref":
          (workflowRunJobs.workflowRun.pull_requests || [{}])[0].head?.ref ||
          undefined,
        "github.base_ref":
          (workflowRunJobs.workflowRun.pull_requests || [{}])[0].base?.ref ||
          undefined,
        "github.base_sha":
          (workflowRunJobs.workflowRun.pull_requests || [{}])[0].base?.sha ||
          undefined,
        error: workflowRunJobs.workflowRun.conclusion === "failure",
      },
      root: true,
      startTime,
    },
    ROOT_CONTEXT
  );
  core.info(`TraceID: ${rootSpan.spanContext().traceId}`);
  let code = SpanStatusCode.OK;
  if (workflowRunJobs.workflowRun.conclusion === "failure") {
    code = SpanStatusCode.ERROR;
  }
  rootSpan.setStatus({ code });
  core.info(
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
  core.info(`Trace Job ${job.id}`);
  if (!job.completed_at) {
    console.warn(`Job ${job.id} is not completed yet`);
    return;
  }
  job.name;
  const ctx = trace.setSpan(parentContext, parentSpan);
  const startTime = new Date(job.started_at);
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
        "github.conclusion": job.conclusion || undefined,
        error: job.conclusion === "failure",
      },
      startTime,
    },
    ctx
  );
  core.info(`Job Span: ${span.spanContext().spanId}: ${job.started_at}`);

  try {
    let code = SpanStatusCode.OK;
    if (job.conclusion === "failure") {
      code = SpanStatusCode.ERROR;
    }
    span.setStatus({ code });
    const numSteps = job.steps?.length || 0;
    core.info(`Trace ${numSteps} Steps`);
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
    span.end(new Date(job.completed_at));
  }
}
