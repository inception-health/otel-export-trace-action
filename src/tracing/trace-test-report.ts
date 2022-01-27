import { ContextAPI, Span, TraceAPI, Tracer } from "@opentelemetry/api";
import { parse } from "test-results-parser";
import TestCase = require("test-results-parser/src/models/TestCase");
import TestSuite = require("test-results-parser/src/models/TestSuite");

export type TraceJunitArtifactParams = {
  trace: TraceAPI;
  tracer: Tracer;
  context: ContextAPI;
  stepSpan: Span;
  path: string;
  startTime: Date;
  type: string;
};

export function traceTestReportArtifact({
  trace,
  tracer,
  context,
  stepSpan,
  startTime,
  path,
  type,
}: TraceJunitArtifactParams) {
  if (!(type in ["junit", "xunit", "ngunit"])) {
    console.log(
      `Report tracing only supports junit, xunit, or ngunit. ${type} is not supported`
    );
    return;
  }
  const result = parse({ type, files: [path] });
  stepSpan.setAttributes({
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
    const testSuiteCtx = trace.setSpan(context.active(), stepSpan);
    const testSuiteSpan = tracer.startSpan(
      testSuite.name,
      {
        startTime,
        attributes: {
          "tests.testSuite.duration": testSuite.duration,
          "tests.testSuite.errors": testSuite.errors,
          "tests.testSuite.failed": testSuite.failed,
          "tests.testSuite.name": testSuite.name,
          "tests.testSuite.passed": testSuite.passed,
          "tests.testSuite.skipped": testSuite.skipped,
          "tests.testSuite.status": testSuite.status,
          "tests.testSuite.total": testSuite.total,
        },
      },
      testSuiteCtx
    );
    traceTestCases({
      startTime,
      testSuite,
      trace,
      context,
      testSuiteSpan,
      tracer,
    });
  });
}

type TraceTestCasesParams = {
  startTime: Date;
  testSuite: TestSuite;
  trace: TraceAPI;
  context: ContextAPI;
  testSuiteSpan: Span;
  tracer: Tracer;
};

function traceTestCases({
  startTime,
  testSuite,
  trace,
  context,
  testSuiteSpan,
  tracer,
}: TraceTestCasesParams) {
  try {
    let testCaseStartTime = new Date(startTime);
    testSuite.cases.map((testCase) => {
      const testCaseCtx = trace.setSpan(context.active(), testSuiteSpan);
      const testCaseSpan = tracer.startSpan(
        testCase.name,
        {
          startTime: testCaseStartTime,
          attributes: {
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
          },
        },
        testCaseCtx
      );
      testCaseStartTime = traceTestSteps({
        testCaseStartTime,
        testCase,
        trace,
        context,
        testCaseSpan,
        tracer,
      });
    });
  } finally {
    const endTime = new Date(startTime);
    endTime.setMilliseconds(
      endTime.getMilliseconds() + testSuite.duration * 1000
    );
    testSuiteSpan.end(endTime);
  }
}

type TraceTestStepsParams = {
  testCaseStartTime: Date;
  testCase: TestCase;
  trace: TraceAPI;
  context: ContextAPI;
  testCaseSpan: Span;
  tracer: Tracer;
};

function traceTestSteps({
  testCaseStartTime,
  testCase,
  trace,
  context,
  testCaseSpan,
  tracer,
}: TraceTestStepsParams) {
  try {
    let testStepStartTime = new Date(testCaseStartTime);
    testCase.steps.map((testStep) => {
      const testStepCtx = trace.setSpan(context.active(), testCaseSpan);
      const testStepSpan = tracer.startSpan(
        testStep.name,
        {
          startTime: testStepStartTime,
          attributes: {
            "tests.testStep.duration": testStep.duration,
            "tests.testStep.failure": testStep.failure,
            "tests.testStep.name": testStep.name,
            "tests.testStep.stack_trace": testStep.stack_trace,
            "tests.testStep.status": testStep.status,
          },
        },
        testStepCtx
      );
      const endTime = new Date(testStepStartTime);
      endTime.setMilliseconds(
        testStepStartTime.getMilliseconds() + testStep.duration * 1000
      );
      testStepSpan.end(endTime);
      testStepStartTime = endTime;
    });
  } finally {
    const endTime = new Date(testCaseStartTime);
    endTime.setMilliseconds(
      testCaseStartTime.getMilliseconds() + testCase.duration * 1000
    );
    testCaseSpan.end(endTime);
    testCaseStartTime = endTime;
  }
  return testCaseStartTime;
}
