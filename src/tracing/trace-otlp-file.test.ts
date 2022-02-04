import path from "path";
import { trace, ROOT_CONTEXT, SpanStatusCode } from "@opentelemetry/api";
import {
  Tracer,
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { IdGenerator } from "@opentelemetry/core";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

import { traceOTLPFile } from "./trace-otlp-file";
class TestIdGenerator implements IdGenerator {
  traceIdCounter: number;
  spanIdCounter: number;

  constructor() {
    this.traceIdCounter = 0;
    this.spanIdCounter = 0;
  }
  generateTraceId() {
    this.traceIdCounter += 1;
    return `${this.traceIdCounter}`;
  }

  generateSpanId() {
    this.spanIdCounter += 1;
    return `${this.spanIdCounter}`;
  }
}

describe("traceJunitArtifact", () => {
  let memoryExporter: InMemorySpanExporter;
  let tracerProvider: BasicTracerProvider;
  let tracer: Tracer;

  beforeAll(() => {
    memoryExporter = new InMemorySpanExporter();
    tracerProvider = new BasicTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: "traceTestReportArtifact",
      }),
    });
    tracerProvider.addSpanProcessor(new SimpleSpanProcessor(memoryExporter));
    tracerProvider.register();
    tracer = tracerProvider.getTracer("default");
  });

  beforeEach(() => {
    memoryExporter.reset();
  });

  afterEach(() => {
    // clear require cache
    Object.keys(require.cache).forEach((key) => delete require.cache[key]);
  });

  afterAll(() => {
    return tracerProvider.shutdown();
  });

  it("testsuites otlp trace", async () => {
    const junitFilePath = path.join(
      "src",
      "tracing",
      "__assets__",
      "testsuites-trace.otlp"
    );
    const startTime = new Date("2022-01-22T04:45:30");

    const span = tracer.startSpan(
      "traceTestReportArtifact",
      { startTime, root: true, attributes: { root: true } },
      ROOT_CONTEXT
    );
    await traceOTLPFile({
      tracer,
      parentContext: ROOT_CONTEXT,
      parentSpan: span,
      startTime,
      path: junitFilePath,
    });
    span.end(new Date("2022-01-22T04:45:34"));

    const spans = memoryExporter.getFinishedSpans();
    expect(spans.length).toEqual(9);

    spans.forEach((s) => {
      expect(s.attributes).toBeDefined();
      expect(Object.keys(s.attributes).length).toBeGreaterThan(0);
      expect(s.endTime).toBeDefined();
      expect(s.startTime).toBeDefined();
      expect(s.endTime[0]).toBeGreaterThanOrEqual(s.startTime[0]);
      expect(s.endTime[1]).toBeGreaterThanOrEqual(s.startTime[1]);
      expect(s.status).toBeDefined();
      if (s.status.code === SpanStatusCode.ERROR) {
        expect(s.attributes.error).toBeTruthy();
      } else {
        expect(s.attributes.error).toBeFalsy();
      }
    });
  });

  it("testsuite otlp trace", async () => {
    const junitFilePath = path.join(
      "src",
      "tracing",
      "__assets__",
      "testsuite-trace.otlp"
    );
    const startTime = new Date("2022-01-22T04:45:30");

    const span = tracer.startSpan(
      "traceTestReportArtifact",
      { startTime, root: true, attributes: { root: true } },
      ROOT_CONTEXT
    );
    await traceOTLPFile({
      tracer,
      parentContext: ROOT_CONTEXT,
      parentSpan: span,
      startTime,
      path: junitFilePath,
    });
    span.end(new Date("2022-01-22T04:45:34"));

    const spans = memoryExporter.getFinishedSpans();
    expect(spans.length).toEqual(7);

    spans.forEach((s) => {
      expect(s.attributes).toBeDefined();
      expect(Object.keys(s.attributes).length).toBeGreaterThan(0);
      expect(s.endTime).toBeDefined();
      expect(s.startTime).toBeDefined();
      expect(s.endTime[0]).toBeGreaterThanOrEqual(s.startTime[0]);
      expect(s.endTime[1]).toBeGreaterThanOrEqual(s.startTime[1]);
      expect(s.status).toBeDefined();
      if (s.status.code === SpanStatusCode.ERROR) {
        expect(s.attributes.error).toBeTruthy();
      } else {
        expect(s.attributes.error).toBeFalsy();
      }
    });
  });

  it("test failed otlp trace", async () => {
    const junitFilePath = path.join(
      "src",
      "tracing",
      "__assets__",
      "fail-test-trace.otlp"
    );
    const startTime = new Date("2022-02-01T18:37:11");

    const span = tracer.startSpan(
      "traceTestReportArtifact",
      { startTime, root: true, attributes: { root: true } },
      ROOT_CONTEXT
    );
    await traceOTLPFile({
      tracer,
      parentContext: ROOT_CONTEXT,
      parentSpan: span,
      startTime,
      path: junitFilePath,
    });
    span.end(new Date("2022-02-01T18:37:14"));

    const spans = memoryExporter.getFinishedSpans();
    expect(spans.length).toEqual(14);

    spans.forEach((s) => {
      expect(s.attributes).toBeDefined();
      expect(Object.keys(s.attributes).length).toBeGreaterThan(0);
      expect(s.endTime).toBeDefined();
      expect(s.startTime).toBeDefined();
      expect(s.endTime[0]).toBeGreaterThanOrEqual(s.startTime[0]);
      expect(s.endTime[1]).toBeGreaterThanOrEqual(s.startTime[1]);
      expect(s.status).toBeDefined();
      if (s.status.code === SpanStatusCode.ERROR) {
        expect(s.attributes.error).toBeTruthy();
      } else {
        expect(s.attributes.error).toBeFalsy();
      }
    });
  });
});
