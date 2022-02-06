import path from "path";
import * as api from "@opentelemetry/api";
import {
  Tracer,
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  Span,
} from "@opentelemetry/sdk-trace-base";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

import { traceOTLPFile } from "./trace-otlp-file";

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
      api.ROOT_CONTEXT
    );
    await traceOTLPFile({
      tracer,
      parentSpan: span as Span,
      startTime,
      path: junitFilePath,
    });
    span.end(new Date("2022-01-22T04:45:34"));

    const spans = memoryExporter.getFinishedSpans();
    expect(spans.length).toEqual(8);

    spans.forEach((s) => {
      expect(s.attributes).toBeDefined();
      expect(Object.keys(s.attributes).length).toBeGreaterThan(0);
      expect(s.endTime).toBeDefined();
      expect(s.startTime).toBeDefined();
      expect(s.endTime[0]).toBeGreaterThanOrEqual(s.startTime[0]);
      expect(s.endTime[1]).toBeGreaterThanOrEqual(s.startTime[1]);
      expect(s.status).toBeDefined();
      if (s.status.code === api.SpanStatusCode.ERROR) {
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
      api.ROOT_CONTEXT
    );
    await traceOTLPFile({
      tracer,
      parentSpan: span as Span,
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
      if (s.status.code === api.SpanStatusCode.ERROR) {
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
      api.ROOT_CONTEXT
    );
    await traceOTLPFile({
      tracer,
      parentSpan: span as Span,
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
      if (s.status.code === api.SpanStatusCode.ERROR) {
        expect(s.attributes.error).toBeTruthy();
      } else {
        expect(s.attributes.error).toBeFalsy();
      }
    });
  });
});
