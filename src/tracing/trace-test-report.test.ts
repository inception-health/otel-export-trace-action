import { traceTestReportArtifact } from "./trace-test-report";
import path from "path";
import { trace, ROOT_CONTEXT } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { IdGenerator } from "@opentelemetry/core";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

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
  const memoryExporter = new InMemorySpanExporter();
  const tracerProvider = new BasicTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: "traceTestReportArtifact",
    }),
    idGenerator: new TestIdGenerator(),
  });
  tracerProvider.addSpanProcessor(new SimpleSpanProcessor(memoryExporter));
  tracerProvider.register();
  const tracer = trace.getTracer("default");

  beforeEach(() => {
    memoryExporter.reset();
  });

  afterEach(() => {
    // clear require cache
    Object.keys(require.cache).forEach((key) => delete require.cache[key]);
    return tracerProvider.shutdown();
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
