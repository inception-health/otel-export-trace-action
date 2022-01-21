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
} from "../github";

import { traceWorkflowRunStep } from "./step";

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
      traceWorkflowRunJob({
        context,
        trace,
        rootSpan,
        tracer,
        job,
        workflowArtifacts: workflowRunJobs.workflowRunArtifacts,
      });
    });
  } finally {
    rootSpan.end(new Date(workflowRunJobs.workflowRun.updated_at));
  }
}

type TraceWorkflowRunJobParams = {
  context: ContextAPI;
  trace: TraceAPI;
  rootSpan: Span;
  tracer: Tracer;
  job: WorkflowRunJob;
  workflowArtifacts: WorkflowArtifactMap;
};

function traceWorkflowRunJob({
  context,
  trace,
  rootSpan,
  tracer,
  job,
  workflowArtifacts,
}: TraceWorkflowRunJobParams) {
  console.log(`Trace Job ${job.id}`);
  if (!job.completed_at) {
    console.warn(`Job ${job.id} is not completed yet`);
    return;
  }
  job.name;
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
      traceWorkflowRunStep({
        job,
        context,
        trace,
        jobSpan,
        tracer,
        workflowArtifacts,
        step,
      });
    });
  } finally {
    const completedAt: string = job.completed_at;
    jobSpan.end(new Date(completedAt));
  }
}
