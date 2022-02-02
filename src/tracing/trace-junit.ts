import {
  Span,
  TraceAPI,
  Tracer,
  Context,
  SpanStatusCode,
} from "@opentelemetry/api";
import { parse, TestCase, TestSuite, TestSuites } from "junit2json";
import fs from "fs";

export type TraceJunitArtifactParams = {
  trace: TraceAPI;
  tracer: Tracer;
  parentContext: Context;
  parentSpan: Span;
  startTime: Date;
  path: string;
};

export async function traceJunitArtifact({
  trace,
  tracer,
  path,
  parentContext,
  parentSpan,
  startTime,
}: TraceJunitArtifactParams) {
  const xmlString = fs.readFileSync(path, { encoding: "utf-8" });
  const result = await parse(xmlString);
  let endTimeSec: number = result.time || 0;
  const ctx = trace.setSpan(parentContext, parentSpan);
  const span = tracer.startSpan(
    result.name || "Junit Test Runs",
    {
      startTime,
      attributes: {
        "test.type": "junit",
        "test.scope": "Run",
        "test.name": result.name || "Junit Test Runs",
        "test.tests": result.tests,
        "test.failures": result.failures,
        "test.errors": result.errors,
        "test.disabled": result.disabled,
        "tests.time": result.time,
      },
    },
    ctx
  );

  try {
    let code = SpanStatusCode.OK;
    /* istanbul ignore next */
    if (
      (result.errors && result.errors > 0) ||
      (result.failures && result.failures > 0)
    ) {
      code = SpanStatusCode.ERROR;
    }
    span.setStatus({ code });
    span.setAttribute("error", code === SpanStatusCode.ERROR);
    if ("testcase" in result) {
      const testSuite: TestSuite = result;
      traceTestSuite({
        testSuite,
        parentContext: ctx,
        parentSpan: span,
        trace,
        tracer,
        startTime: new Date(testSuite.timestamp || startTime),
      });
    } else if ("testsuite" in result) {
      const testSuites: TestSuites = result;

      const testSuiteTimes = testSuites.testsuite.map((testSuite) =>
        traceTestSuite({
          testSuite,
          parentContext: ctx,
          parentSpan: span,
          startTime: new Date(testSuite.timestamp || startTime),
          tracer,
          trace,
        })
      );
      endTimeSec = endTimeSec || testSuiteTimes.reduce((r, i) => r + i, 0);
    }
  } finally {
    const endTime = new Date(startTime);
    endTime.setMilliseconds(startTime.getMilliseconds() + endTimeSec * 1000);
    span.end(endTime);
  }
}

type TraceTestSuiteParams = {
  testSuite: TestSuite;
  parentContext: Context;
  parentSpan: Span;
  startTime: Date;
  tracer: Tracer;
  trace: TraceAPI;
};
export function traceTestSuite({
  testSuite,
  trace,
  tracer,
  startTime,
  parentSpan,
  parentContext,
}: TraceTestSuiteParams): number {
  const ctx = trace.setSpan(parentContext, parentSpan);
  const span = tracer.startSpan(
    testSuite.name,
    {
      startTime,
      attributes: {
        "test.name": testSuite.name,
        "test.scope": "Suite",
        "test.tests": testSuite.tests,
        "test.failures": testSuite.failures,
        "test.errors": testSuite.errors,
        "test.time": testSuite.time,
        "test.disabled": testSuite.disabled,
        "test.skipped": testSuite.skipped,
        "test.timestamp": testSuite.timestamp,
        "test.hostname": testSuite.hostname,
        "test.id": testSuite.id,
        "test.package": testSuite.package,
        "test.system.out": testSuite["system-out"],
        "test.system.err": testSuite["system-err"],
      },
    },
    ctx
  );

  let code = SpanStatusCode.OK;
  /* istanbul ignore next */
  if (
    (testSuite.errors && testSuite.errors > 0) ||
    (testSuite.failures && testSuite.failures > 0)
  ) {
    code = SpanStatusCode.ERROR;
  }
  span.setStatus({ code });
  span.setAttribute("error", code === SpanStatusCode.ERROR);
  let testCaseTime = new Date(startTime);
  let testCasesTimeSec = testSuite.time || 0;
  try {
    const testCasesTimes = testSuite.testcase.map((testCase) => {
      const testCaseTimeSec = traceTestCase({
        testCase,
        tracer,
        trace,
        parentSpan: span,
        parentContext: ctx,
        startTime: testCaseTime,
      });
      testCaseTime = new Date(testCaseTime);
      testCaseTime.setMilliseconds(
        testCaseTime.getMilliseconds() + (testCase.time || testCaseTimeSec)
      );
      return testCaseTimeSec;
    });
    testCasesTimeSec =
      testCasesTimeSec || testCasesTimes.reduce((r, i) => r + i, 0);
  } finally {
    const endTime = new Date(startTime);
    endTime.setMilliseconds(
      startTime.getMilliseconds() + testCasesTimeSec * 1000
    );
    span.end(endTime);
  }
  return testCasesTimeSec;
}

type TraceTestCaseParams = {
  testCase: TestCase;
  parentContext: Context;
  parentSpan: Span;
  startTime: Date;
  tracer: Tracer;
  trace: TraceAPI;
};
export function traceTestCase({
  testCase,
  parentContext,
  parentSpan,
  startTime,
  tracer,
  trace,
}: TraceTestCaseParams): number {
  const ctx = trace.setSpan(parentContext, parentSpan);
  const span = tracer.startSpan(
    testCase.name,
    {
      startTime,
      attributes: {
        "test.name": testCase.name,
        "test.scope": "Case",
        "test.classname": testCase.classname,
        "test.time": testCase.time,
        "test.status": testCase.status,
        "test.assertions": testCase.assertions,
        "test.system.out": testCase["system-out"],
        "test.system.err": testCase["system-err"],
      },
    },
    ctx
  );
  try {
    let code: SpanStatusCode = SpanStatusCode.OK;
    if (testCase.status !== "PASS") {
      code = SpanStatusCode.ERROR;
    }
    span.setStatus({ code });
    span.setAttribute("error", code === SpanStatusCode.ERROR);

    /* istanbul ignore next */
    testCase.skipped?.forEach(({ message }, index) => {
      if (message) {
        span.setAttribute(`test.skipped.${index}.message`, message);
      }
    });

    /* istanbul ignore next */
    testCase.error?.forEach(({ message, type, inner }, index) => {
      if (message) {
        span.setAttribute(`test.error.${index}.message`, message);
      }
      if (type) {
        span.setAttribute(`test.error.${index}.type`, type);
      }
      if (inner) {
        span.setAttribute(`test.error.${index}.inner`, inner);
      }
    });
    /* istanbul ignore next */
    testCase.failure?.forEach(({ message, type, inner }, index) => {
      if (message) {
        span.setAttribute(`test.failure.${index}.message`, message);
      }
      if (type) {
        span.setAttribute(`test.failure.${index}.type`, type);
      }
      if (inner) {
        span.setAttribute(`test.failure.${index}.inner`, inner);
      }
    });
  } finally {
    const endTime = new Date(startTime);
    endTime.setMilliseconds(
      startTime.getMilliseconds() + (testCase.time || 0) * 1000
    );
    span.end(endTime);
  }

  return testCase.time || 0;
}
