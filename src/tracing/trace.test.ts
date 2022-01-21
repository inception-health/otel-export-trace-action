import { createTracerProvider } from "./trace";
import { WorkflowRunJobs } from "../github";
import { createMock } from "ts-auto-mock";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";

describe("createTracerProvider", () => {
  let subject: BasicTracerProvider;
  let mockWorkflowRunJobs: WorkflowRunJobs;

  beforeEach(() => {
    jest.useFakeTimers();
    mockWorkflowRunJobs = createMock<WorkflowRunJobs>({
      workflowRun: {
        name: "workflow-name",
        workflow_id: 1,
        id: 1,
        repository: {
          full_name: "test/repo",
        },
        head_sha: "head-sha",
      },
    });
    subject = createTracerProvider(
      "localhost",
      "test=foo",
      mockWorkflowRunJobs
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    return subject.shutdown();
  });

  it("test service.name resource", () => {
    expect(
      subject.resource.attributes[SemanticResourceAttributes.SERVICE_NAME]
    ).toEqual(mockWorkflowRunJobs.workflowRun.name);
  });

  it("test service.instance.id resource", () => {
    expect(
      subject.resource.attributes[
        SemanticResourceAttributes.SERVICE_INSTANCE_ID
      ]
    ).toEqual(
      [
        mockWorkflowRunJobs.workflowRun.repository.full_name,
        mockWorkflowRunJobs.workflowRun.workflow_id,
        mockWorkflowRunJobs.workflowRun.id,
        mockWorkflowRunJobs.workflowRun.run_attempt,
      ].join("/")
    );
  });

  it("test service.namespace resource", () => {
    expect(
      subject.resource.attributes[SemanticResourceAttributes.SERVICE_NAMESPACE]
    );
  });

  it("test active span processor", () => {
    const spanProcessor = subject.getActiveSpanProcessor();
    expect(spanProcessor).toBeDefined();
  });
});
