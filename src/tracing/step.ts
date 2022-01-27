import { Context } from "@actions/github/lib/context";
import { ContextAPI, Span, TraceAPI, Tracer } from "@opentelemetry/api";

import {
  WorkflowRunJobStep,
  WorkflowArtifactMap,
  WorkflowRunJob,
  WorkflowArtifactLookup,
} from "../github";
import { traceTestReportArtifact } from "./trace-test-report";

export type TraceWorkflowRunStepParams = {
  job: WorkflowRunJob;
  context: ContextAPI;
  trace: TraceAPI;
  jobSpan: Span;
  tracer: Tracer;
  workflowArtifacts: WorkflowArtifactLookup;
  step?: WorkflowRunJobStep;
};
export function traceWorkflowRunStep({
  job,
  context,
  trace,
  jobSpan,
  tracer,
  workflowArtifacts,
  step,
}: TraceWorkflowRunStepParams) {
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
        error: step.conclusion === "failure",
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
    traceArtifact({
      trace,
      tracer,
      stepSpan,
      context,
      job,
      step,
      startTime,
      workflowArtifacts,
    });
  } finally {
    stepSpan.end(new Date(step.completed_at));
  }
}

type TraceArtifactParams = {
  trace: TraceAPI;
  tracer: Tracer;
  context: ContextAPI;
  stepSpan: Span;
  job: WorkflowRunJob;
  step: WorkflowRunJobStep;
  startTime: Date;
  workflowArtifacts: WorkflowArtifactLookup;
};

function traceArtifact({
  trace,
  tracer,
  stepSpan,
  job,
  step,
  context,
  startTime,
  workflowArtifacts,
}: TraceArtifactParams) {
  const artifact = workflowArtifacts(job.name, step.name);
  if (artifact) {
    traceTestReportArtifact({
      trace,
      tracer,
      context,
      stepSpan,
      startTime,
      type: artifact.reportType,
      path: artifact.path,
    });
  } else {
    console.log(`No Artifact to trace for Job<${job.name}> Step<${step.name}>`);
  }
}
