import { ContextAPI, Span, TraceAPI, Tracer } from "@opentelemetry/api";

import {
  WorkflowRunJobStep,
  WorkflowArtifactMap,
  WorkflowRunJob,
} from "../github";

export type TraceWorkflowRunStepParams = {
  job: WorkflowRunJob;
  context: ContextAPI;
  trace: TraceAPI;
  jobSpan: Span;
  tracer: Tracer;
  workflowArtifacts: WorkflowArtifactMap;
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
      job,
      step,
      workflowArtifacts,
    });
  } finally {
    stepSpan.end(new Date(step.completed_at));
  }
}

type TraceArtifactParams = {
  trace: TraceAPI;
  tracer: Tracer;
  stepSpan: Span;
  job: WorkflowRunJob;
  step: WorkflowRunJobStep;
  workflowArtifacts: WorkflowArtifactMap;
};

function traceArtifact({ job, step, workflowArtifacts }: TraceArtifactParams) {
  const junitArtifactName = `${job.name}/${step.name}/junit.xml`;
  const junitArtifact = workflowArtifacts[junitArtifactName];
}
