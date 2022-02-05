import { Tracer, Span as SpanImpl } from "@opentelemetry/sdk-trace-base";
import { TraceState } from "@opentelemetry/core";
import { otlpTypes } from "@opentelemetry/exporter-trace-otlp-http";
import * as core from "@actions/core";
import * as fs from "fs";
import * as readline from "readline";
import * as api from "@opentelemetry/api";
import { Attributes, AttributeValue, Link } from "@opentelemetry/api";

type ExportTraceServiceRequest =
  otlpTypes.opentelemetryProto.collector.trace.v1.ExportTraceServiceRequest;

/* istanbul ignore next */
function toSpanKind(
  spanKind: otlpTypes.opentelemetryProto.trace.v1.Span.SpanKind | undefined
): api.SpanKind {
  switch (spanKind) {
    /* istanbul ignore next */
    case otlpTypes.opentelemetryProto.trace.v1.Span.SpanKind.SPAN_KIND_CLIENT:
      return api.SpanKind.CLIENT;
    /* istanbul ignore next */
    case otlpTypes.opentelemetryProto.trace.v1.Span.SpanKind.SPAN_KIND_CONSUMER:
      return api.SpanKind.CONSUMER;
    case otlpTypes.opentelemetryProto.trace.v1.Span.SpanKind.SPAN_KIND_INTERNAL:
      return api.SpanKind.INTERNAL;
    /* istanbul ignore next */
    case otlpTypes.opentelemetryProto.trace.v1.Span.SpanKind.SPAN_KIND_PRODUCER:
      return api.SpanKind.PRODUCER;
    /* istanbul ignore next */
    case otlpTypes.opentelemetryProto.trace.v1.Span.SpanKind.SPAN_KIND_SERVER:
      return api.SpanKind.SERVER;
    /* istanbul ignore next */
    default:
      return api.SpanKind.INTERNAL;
  }
}

function toLinks(
  links: otlpTypes.opentelemetryProto.trace.v1.Span.Link[] | undefined
): Link[] | undefined {
  /* istanbul ignore if */
  if (links === undefined) {
    return undefined;
  }
  // TODO implement Links
}

function toAttributeValue(
  value: otlpTypes.opentelemetryProto.common.v1.AnyValue
): AttributeValue | undefined {
  /* istanbul ignore else */
  if ("stringValue" in value) {
    return value.stringValue;
  } else if ("arrayValue" in value) {
    return JSON.stringify(value.arrayValue?.values);
  } else if ("boolValue" in value) {
    return value.boolValue;
  } else if ("doubleValue" in value) {
    return value.doubleValue;
  } else if ("intValue" in value) {
    return value.intValue;
  } else if ("kvlistValue" in value) {
    return JSON.stringify(
      value.kvlistValue?.values.reduce((result, { key, value }) => {
        return { ...result, [key]: toAttributeValue(value) };
      }, {})
    );
  }
  /* istanbul ignore next */
  return undefined;
}

function toAttributes(
  attributes: otlpTypes.opentelemetryProto.common.v1.KeyValue[] | undefined
): Attributes {
  /* istanbul ignore if */
  if (!attributes) {
    return {};
  }

  const rv: Attributes = attributes.reduce((result, { key, value }) => {
    return { ...result, [key]: toAttributeValue(value) };
  }, {} as Attributes);

  return rv;
}

type ToSpanParams = {
  otlpSpan: otlpTypes.opentelemetryProto.trace.v1.Span;
  tracer: Tracer;
  parentSpan: api.Span;
};

function toSpan({ otlpSpan, tracer, parentSpan }: ToSpanParams): api.Span {
  return new SpanImpl(
    tracer,
    api.context.active(),
    otlpSpan.name as string,
    {
      traceId: parentSpan.spanContext().traceId,
      spanId: otlpSpan.spanId,
      traceFlags: parentSpan.spanContext().traceFlags,
      traceState: new TraceState(otlpSpan.traceState),
    },
    toSpanKind(otlpSpan.kind),
    otlpSpan.parentSpanId || parentSpan.spanContext().spanId,
    toLinks(otlpSpan.links),
    otlpSpan.startTimeUnixNano
  );
}

export type TraceOTLPFileParams = {
  tracer: Tracer;
  parentSpan: api.Span;
  path: string;
  startTime: Date;
};
export async function traceOTLPFile({
  tracer,
  parentSpan,
  path,
}: TraceOTLPFileParams): Promise<void> {
  const readStream = fs.createReadStream(path);
  const rl = readline.createInterface({
    input: readStream,
    crlfDelay: Infinity,
  });
  try {
    for await (const line of rl) {
      core.info("Tracing test OTLP Service Request");
      core.info(line);
      const serviceRequest: ExportTraceServiceRequest = JSON.parse(
        line
      ) as ExportTraceServiceRequest;
      for (const resourceSpans of serviceRequest.resourceSpans) {
        for (const libSpans of resourceSpans.instrumentationLibrarySpans) {
          if (libSpans.instrumentationLibrary) {
            for (const otlpSpan of libSpans.spans) {
              core.info(`Trace test Span<${otlpSpan.spanId}>`);
              const span = toSpan({
                otlpSpan,
                tracer,
                parentSpan,
              });
              const attributes = toAttributes(otlpSpan.attributes);
              if (attributes) {
                span.setAttributes(attributes);
              }
              if (otlpSpan.status) {
                span.setStatus(otlpSpan.status);
              }
              span.end(otlpSpan.endTimeUnixNano);
            }
          }
        }
      }
    }
  } finally {
    readStream.close();
  }
}
