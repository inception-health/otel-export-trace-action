import {
  Span,
  TraceAPI,
  Tracer,
  Context,
  SpanStatusCode,
  SpanStatus,
} from "@opentelemetry/api";
import { parse } from "test-results-parser";
import TestCase = require("test-results-parser/src/models/TestCase");
import TestStep = require("test-results-parser/src/models/TestStep");
import TestSuite = require("test-results-parser/src/models/TestSuite");

export type TraceJunitArtifactParams = {
  trace: TraceAPI;
  tracer: Tracer;
  parentContext: Context;
  parentSpan: Span;
  startTime: Date;
  path: string;
  type: string;
};

export function traceTestReportArtifact({
  tracer,
  trace,
  parentSpan,
  startTime,
  parentContext,
  path,
  type,
}: TraceJunitArtifactParams) {
  if (!["junit", "xunit", "ngunit"].includes(type)) {
    throw TypeError(
      `Report tracing only supports junit, xunit, or ngunit. ${type} is not supported`
    );
  }
  const result = parse({ type, files: [path] });
  parentSpan.setAttributes({
    "tests.type": type,
    "tests.total": result.total,
    "tests.name": result.name,
    "tests.passed": result.passed,
    "tests.failed": result.failed,
    "tests.errors": result.errors,
    "tests.skipped": result.skipped,
    "tests.retried": result.retried,
    "tests.status": result.status,
  });

  result.suites.map((testSuite) => {
    traceTestSuite({
      startTime,
      testSuite,
      parentContext,
      parentSpan,
      tracer,
      trace,
    });
  });
  parentSpan.setStatus({
    code: result.status === "PASS" ? SpanStatusCode.OK : SpanStatusCode.ERROR,
  });
}
type TraceTestSuiteParams = {
  testSuite: TestSuite;
  parentContext: Context;
  parentSpan: Span;
  startTime: Date;
  tracer: Tracer;
  trace: TraceAPI;
};

function traceTestSuite({
  testSuite,
  parentContext,
  parentSpan,
  startTime,
  trace,
  tracer,
}: TraceTestSuiteParams) {
  const attributes = {
    "tests.testSuite.duration": testSuite.duration,
    "tests.testSuite.errors": testSuite.errors,
    "tests.testSuite.failed": testSuite.failed,
    "tests.testSuite.name": testSuite.name,
    "tests.testSuite.passed": testSuite.passed,
    "tests.testSuite.skipped": testSuite.skipped,
    "tests.testSuite.status": testSuite.status,
    "tests.testSuite.total": testSuite.total,
  };
  const ctx = trace.setSpan(parentContext, parentSpan);
  const span = tracer.startSpan(testSuite.name, { startTime, attributes }, ctx);
  span.setStatus({
    code:
      testSuite.status === "PASS" ? SpanStatusCode.OK : SpanStatusCode.ERROR,
  });
  let testCaseStartTime = new Date(startTime);
  try {
    testSuite.cases.map((testCase) => {
      traceTestCases({
        testCase,
        startTime: testCaseStartTime,
        parentContext: ctx,
        parentSpan: span,
        trace,
        tracer,
      });
      testCaseStartTime = new Date(testCaseStartTime);
      testCaseStartTime.setMilliseconds(
        testCaseStartTime.getMilliseconds() + testCase.duration * 1000
      );
    });
  } finally {
    const endTime = new Date(startTime);
    endTime.setMilliseconds(
      startTime.getMilliseconds() + testSuite.duration * 1000
    );
    span.end(endTime);
  }
}

type TraceTestCasesParams = {
  testCase: TestCase;
  parentContext: Context;
  parentSpan: Span;
  startTime: Date;
  tracer: Tracer;
  trace: TraceAPI;
};

function traceTestCases({
  testCase,
  parentContext,
  parentSpan,
  startTime,
  trace,
  tracer,
}: TraceTestCasesParams) {
  const attributes = {
    "tests.testCase.duration": testCase.duration,
    "tests.testCase.errors": testCase.errors,
    "tests.testCase.failed": testCase.failed,
    "tests.testCase.failure": testCase.failure,
    "tests.testCase.name": testCase.name,
    "tests.testCase.passed": testCase.passed,
    "tests.testCase.skipped": testCase.skipped,
    "tests.testCase.stack_trace": testCase.stack_trace,
    "tests.testCase.status": testCase.status,
    "tests.testCase.total": testCase.total,
  };
  const ctx = trace.setSpan(parentContext, parentSpan);
  const span = tracer.startSpan(testCase.name, { startTime, attributes }, ctx);
  const spanStatus: SpanStatus = {
    code: testCase.status === "PASS" ? SpanStatusCode.OK : SpanStatusCode.ERROR,
  };
  if (testCase.failure) {
    spanStatus.message = testCase.failure;
  }
  span.setStatus(spanStatus);
  // let testStepStartTime = new Date(startTime);
  try {
    // testCase.steps.map((testStep) => {
    //   traceTestSteps({
    //     testStep,
    //     parentContext: ctx,
    //     parentSpan: span,
    //     startTime: testStepStartTime,
    //     trace,
    //     tracer,
    //   });
    //   testStepStartTime = new Date(testStepStartTime);
    //   testStepStartTime.setMilliseconds(
    //     testStepStartTime.getMilliseconds() + testStep.duration * 1000
    //   );
    // });
  } finally {
    const endTime = new Date(startTime);
    endTime.setMilliseconds(
      endTime.getMilliseconds() + testCase.duration * 1000
    );
    span.end(endTime);
  }
}

// type TraceTestStepsParams = {
//   testStep: TestStep;
//   parentContext: Context;
//   parentSpan: Span;
//   startTime: Date;
//   trace: TraceAPI;
//   tracer: Tracer;
// };

// function traceTestSteps({
//   testStep,
//   parentContext,
//   parentSpan,
//   startTime,
//   trace,
//   tracer,
// }: TraceTestStepsParams) {
//   const attributes = {
//     "tests.testStep.duration": testStep.duration,
//     "tests.testStep.failure": testStep.failure,
//     "tests.testStep.name": testStep.name,
//     "tests.testStep.stack_trace": testStep.stack_trace,
//     "tests.testStep.status": testStep.status,
//   };
//   const ctx = trace.setSpan(parentContext, parentSpan);
//   const span = tracer.startSpan(testStep.name, { startTime, attributes }, ctx);

//   const endTime = new Date(startTime);
//   endTime.setMilliseconds(
//     startTime.getMilliseconds() + testStep.duration * 1000
//   );
//   span.end(endTime);
// }
