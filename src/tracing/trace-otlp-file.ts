import { Tracer, Span as SpanImpl } from "@opentelemetry/sdk-trace-base";
import { TraceState } from "@opentelemetry/core";
import {
  IExportTraceServiceRequest,
  ESpanKind,
  ILink,
  IKeyValue,
  IAnyValue,
  ISpan,
} from "@opentelemetry/otlp-transformer";
import * as core from "@actions/core";
import * as fs from "fs";
import * as readline from "readline";
import * as api from "@opentelemetry/api";
import {
  Attributes,
  AttributeValue,
  Link,
  SpanStatusCode,
} from "@opentelemetry/api";

/* istanbul ignore next */
function toSpanKind(spanKind: ESpanKind | undefined): api.SpanKind {
  switch (spanKind) {
    /* istanbul ignore next */
    case ESpanKind.SPAN_KIND_CLIENT:
      return api.SpanKind.CLIENT;
    /* istanbul ignore next */
    case ESpanKind.SPAN_KIND_CONSUMER:
      return api.SpanKind.CONSUMER;
    case ESpanKind.SPAN_KIND_INTERNAL:
      return api.SpanKind.INTERNAL;
    /* istanbul ignore next */
    case ESpanKind.SPAN_KIND_PRODUCER:
      return api.SpanKind.PRODUCER;
    /* istanbul ignore next */
    case ESpanKind.SPAN_KIND_SERVER:
      return api.SpanKind.SERVER;
    /* istanbul ignore next */
    default:
      return api.SpanKind.INTERNAL;
  }
}

function toLinks(links: ILink[] | undefined): Link[] | undefined {
  /* istanbul ignore if */
  if (links === undefined) {
    return undefined;
  }
  // TODO implement Links
}

function toAttributeValue(value: IAnyValue): AttributeValue | undefined {
  /* istanbul ignore else */
  if ("stringValue" in value) {
    return value.stringValue ?? undefined;
  } else if ("arrayValue" in value) {
    return JSON.stringify(value.arrayValue?.values);
  } else if ("boolValue" in value) {
    return value.boolValue ?? undefined;
  } else if ("doubleValue" in value) {
    return value.doubleValue ?? undefined;
  } else if ("intValue" in value) {
    return value.intValue ?? undefined;
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

function toAttributes(attributes: IKeyValue[] | undefined): Attributes {
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
  otlpSpan: ISpan;
  tracer: Tracer;
  parentSpan: api.Span;
};

function toSpan({ otlpSpan, tracer, parentSpan }: ToSpanParams): api.Span {
  return new SpanImpl(
    tracer,
    api.context.active(),
    otlpSpan.name,
    {
      traceId: parentSpan.spanContext().traceId,
      spanId: otlpSpan.spanId,
      traceFlags: parentSpan.spanContext().traceFlags,
      traceState: new TraceState(otlpSpan.traceState ?? undefined),
    },
    toSpanKind(otlpSpan.kind),
    otlpSpan.parentSpanId || parentSpan.spanContext().spanId,
    toLinks(otlpSpan.links),
    new Date(otlpSpan.startTimeUnixNano / 1000000)
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
  const fileStream = fs.createReadStream(path);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line) {
      const serviceRequest: IExportTraceServiceRequest = JSON.parse(
        line
      ) as IExportTraceServiceRequest;
      for (const resourceSpans of serviceRequest.resourceSpans || []) {
        for (const scopeSpans of resourceSpans.scopeSpans) {
          if (scopeSpans.scope) {
            for (const otlpSpan of scopeSpans.spans || []) {
              core.debug(
                `Trace Test ParentSpan<${
                  otlpSpan.parentSpanId || parentSpan.spanContext().spanId
                }> -> Span<${otlpSpan.spanId}> `
              );
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
                span.setStatus({
                  code: otlpSpan.status.code as unknown as SpanStatusCode,
                  message: otlpSpan.status.message,
                });
              }
              span.end(new Date(otlpSpan.endTimeUnixNano / 1000000));
            }
          }
        }
      }
    }
  }
}
