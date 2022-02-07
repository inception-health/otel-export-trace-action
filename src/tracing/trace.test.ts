import { createTracerProvider } from "./trace";
import { WorkflowRunJobs } from "../github";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";
import { mock } from "jest-mock-extended";

describe("createTracerProvider", () => {
  let subject: BasicTracerProvider;
  let mockWorkflowRunJobs: WorkflowRunJobs;

  beforeEach(() => {
    jest.useFakeTimers();
    mockWorkflowRunJobs = mock<WorkflowRunJobs>({
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
  });

  afterEach(() => {
    jest.useRealTimers();
    return subject.shutdown();
  });
  describe("resource attributes", () => {
    it("has service.name resource as workflow name", () => {
      subject = createTracerProvider(
        "localhost",
        "test=foo",
        mockWorkflowRunJobs
      );
      expect(
        subject.resource.attributes[SemanticResourceAttributes.SERVICE_NAME]
      ).toEqual(mockWorkflowRunJobs.workflowRun.name);
    });

    it("has service.name resource as workflow id", () => {
      mockWorkflowRunJobs.workflowRun.name = undefined;
      subject = createTracerProvider(
        "localhost",
        "test=foo",
        mockWorkflowRunJobs
      );
      expect(
        subject.resource.attributes[SemanticResourceAttributes.SERVICE_NAME]
      ).toEqual(`${mockWorkflowRunJobs.workflowRun.id}`);
    });

    it("has service.instance.id resource", () => {
      subject = createTracerProvider(
        "localhost",
        "test=foo",
        mockWorkflowRunJobs
      );
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

    it("has service.namespace resource", () => {
      subject = createTracerProvider(
        "localhost",
        "test=foo",
        mockWorkflowRunJobs
      );
      expect(
        subject.resource.attributes[
          SemanticResourceAttributes.SERVICE_NAMESPACE
        ]
      ).toEqual(mockWorkflowRunJobs.workflowRun.repository.full_name);
    });
  });

  it("has active span processor", () => {
    subject = createTracerProvider(
      "localhost",
      "test=foo",
      mockWorkflowRunJobs
    );
    const spanProcessor = subject.getActiveSpanProcessor();
    expect(spanProcessor).toBeDefined();
  });
});
