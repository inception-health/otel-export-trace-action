import { traceTestReportArtifact } from "./trace-test-report";
import path from "path";
import { trace, ROOT_CONTEXT, Tracer } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  Span,
} from "@opentelemetry/sdk-trace-base";
import { IdGenerator } from "@opentelemetry/core";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { mock } from "jest-mock-extended";
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

describe("traceTestReportArtifact", () => {
  let memoryExporter: InMemorySpanExporter;
  let tracerProvider: BasicTracerProvider;
  let tracer: Tracer;

  beforeAll(() => {
    memoryExporter = new InMemorySpanExporter();
    tracerProvider = new BasicTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: "traceTestReportArtifact",
      }),
      idGenerator: new TestIdGenerator(),
    });
    tracerProvider.addSpanProcessor(new SimpleSpanProcessor(memoryExporter));
    tracer = trace.getTracer("default");
    tracerProvider.register();
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

  it("test report type not supported", () => {
    const junitFilePath = path.join(
      "src",
      "tracing",
      "__assets__",
      "{lint-and-format-check}{run tests}{junit}.xml"
    );
    const startTime = new Date("2022-01-22T04:45:30");

    const span = mock<Span>();

    try {
      traceTestReportArtifact({
        trace,
        tracer,
        parentContext: ROOT_CONTEXT,
        parentSpan: span,
        startTime,
        path: junitFilePath,
        type: "foo",
      });
      fail("Expected TypeError to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(TypeError);
    }
  });

  it("test junit spans match snapshot", () => {
    const junitFilePath = path.join(
      "src",
      "tracing",
      "__assets__",
      "{lint-and-format-check}{run tests}{junit}.xml"
    );
    const startTime = new Date("2022-01-22T04:45:30");

    const span = tracer.startSpan(
      "traceTestReportArtifact",
      { startTime, root: true },
      ROOT_CONTEXT
    );
    traceTestReportArtifact({
      trace,
      tracer,
      parentContext: ROOT_CONTEXT,
      parentSpan: span,
      startTime,
      path: junitFilePath,
      type: "junit",
    });
    span.end(new Date("2022-01-22T04:45:34"));

    const spans = memoryExporter.getFinishedSpans();
    expect(spans).toMatchSnapshot();
  });
});
