import { ContextAPI, Span, TraceAPI, Tracer } from "@opentelemetry/api";
import { parse } from "test-results-parser";
import TestResult = require("test-results-parser/src/models/TestResult");
import TestStep = require("test-results-parser/src/models/TestStep");
import TestCase = require("test-results-parser/src/models/TestCase");
import TestSuite = require("test-results-parser/src/models/TestSuite");
import {} from "@actions/artifact";
import { WorkflowRunJobStep, WorkflowArtifact } from "../github";

export type TraceJunitArtifactParams = {
  trace: TraceAPI;
  tracer: Tracer;
  stepSpan: Span;
  workflowArtifactKey: string;
  workflowArtifact: WorkflowArtifact;
};
// export async function traceJunitArtifact({
//   trace,
//   tracer,
//   stepSpan,
//   workflowArtifactKey,
//   workflowArtifact,
// }: TraceJunitArtifactParams) {
//   console.log(`Trace Junit Artifact ${workflowArtifactKey}`);
// }
