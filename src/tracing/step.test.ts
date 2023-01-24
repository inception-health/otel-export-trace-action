import { mock, MockProxy } from "jest-mock-extended";

import {
  TraceAPI,
  Context,
  SpanStatusCode,
  Span,
  SpanContext,
} from "@opentelemetry/api";
import { Tracer } from "@opentelemetry/sdk-trace-base";
import { traceWorkflowRunStep } from "./step";
import {
  WorkflowRunJob,
  WorkflowRunJobStep,
  WorkflowArtifactLookup,
} from "github";

describe("traceWorkflowRunStep", () => {
  let mockStepSpan: MockProxy<Span>;
  let mockTracer: MockProxy<Tracer>;
  let mockTrace: MockProxy<TraceAPI>;
  let mockParentSpan: MockProxy<Span>;
  let mockContext: MockProxy<Context>;
  let mockWorkflowArtifacts: MockProxy<WorkflowArtifactLookup>;
  let mockStep: MockProxy<WorkflowRunJobStep>;
  let mockJob: MockProxy<WorkflowRunJob>;
  let mockSpanContext: MockProxy<SpanContext>;

  beforeEach(() => {
    jest.useFakeTimers();
    mockStepSpan = mock<Span>();
    mockTracer = mock<Tracer>();
    mockJob = mock<WorkflowRunJob>();
    mockTrace = mock<TraceAPI>();
    mockSpanContext = mock<SpanContext>({ spanId: "span-id" });
    mockStepSpan.spanContext.mockReturnValue(mockSpanContext);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // describe.each([
  //   undefined,
  //   { completed_at: "2023-01-18T15:27:19.853Z", started_at: undefined },
  //   { completed_at: undefined, started_at: "2023-01-18T15:27:19.853Z" }
  // ])("step == %o", (stepData) => {
  //   beforeEach(() => {

  //   });

  //   it("should not trace step", () => {

  //   });
  // });

  describe.each(["skipped", "canceled"])(
    "step.conclusion == %s",
    (conclusion) => {
      beforeEach(() => {
        mockStep = mock<WorkflowRunJobStep>({
          name: "test-name",
          number: 1,
          started_at: "2023-01-18T14:27:19.853Z",
          completed_at: "2023-01-18T15:27:19.853Z",
          conclusion,
        });
        mockTracer.startSpan.mockReturnValue(mockStepSpan);
      });

      it("should not trace", async () => {
        await traceWorkflowRunStep({
          job: mockJob,
          parentContext: mockContext,
          parentSpan: mockParentSpan,
          tracer: mockTracer,
          trace: mockTrace,
          workflowArtifacts: mockWorkflowArtifacts,
          step: mockStep,
        });
        // expect();
      });
    }
  );
});
