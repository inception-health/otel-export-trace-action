import { traceTestReportArtifact } from "./trace-test-report";
import path from "path";
import { context, trace } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

function idGenerator() {
  let counter = 1;
  return () => {
    counter++;
    return `123456789${counter}`;
  };
}

describe("traceTestReportArtifact", () => {
  const memoryExporter = new InMemorySpanExporter();
  const tracerProvider = new BasicTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]:
        "traceTestReportArtifact - test",
    }),
    idGenerator: {
      generateTraceId: idGenerator(),
      generateSpanId: idGenerator(),
    },
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

    tracer.startActiveSpan(
      "test step span",
      { startTime, root: true },
      (stepSpan) => {
        traceTestReportArtifact({
          trace,
          tracer,
          context,
          stepSpan,
          startTime,
          path: junitFilePath,
          type: "junit",
        });
        stepSpan.end(new Date("2022-01-22T04:45:34"));
      }
    );

    const spans = memoryExporter.getFinishedSpans();
    expect(spans).toMatchSnapshot();
  });
});
