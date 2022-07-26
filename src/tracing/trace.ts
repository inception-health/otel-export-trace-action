import * as grpc from "@grpc/grpc-js";
import {
  BasicTracerProvider,
  SimpleSpanProcessor,
  ConsoleSpanExporter,
  SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { WorkflowRunJobs } from "../github";
import { Resource } from "@opentelemetry/resources";

const OTEL_CONSOLE_ONLY = process.env.OTEL_CONSOLE_ONLY === "true";

type StringDict = { [key: string]: string };

function stringToHeader(value: string): StringDict {
  const pairs = value.split(",");
  return pairs.reduce((result, item) => {
    const [key, value] = item.split("=");
    if (key && value) {
      return {
        ...result,
        [key.trim()]: value.trim(),
      };
    }
    // istanbul ignore next
    return result;
  }, {});
}

export function createTracerProvider(
  otlpEndpoint: string,
  otlpHeaders: string,
  workflowRunJobs: WorkflowRunJobs
): BasicTracerProvider {
  const serviceName =
    workflowRunJobs.workflowRun.name ||
    `${workflowRunJobs.workflowRun.workflow_id}`;
  const serviceInstanceId = [
    workflowRunJobs.workflowRun.repository.full_name,
    workflowRunJobs.workflowRun.workflow_id,
    workflowRunJobs.workflowRun.id,
    workflowRunJobs.workflowRun.run_attempt,
  ].join("/");
  const serviceNamespace = workflowRunJobs.workflowRun.repository.full_name;
  const serviceVersion = workflowRunJobs.workflowRun.head_sha;

  const provider = new BasicTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: serviceInstanceId,
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: serviceNamespace,
      [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
    }),
  });

  let exporter: SpanExporter = new ConsoleSpanExporter();

  if (!OTEL_CONSOLE_ONLY) {
    exporter = new OTLPTraceExporter({
      url: otlpEndpoint,
      credentials: grpc.credentials.createSsl(),
      metadata: grpc.Metadata.fromHttp2Headers(stringToHeader(otlpHeaders)),
    });
  }

  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
  provider.register();

  return provider;
}
