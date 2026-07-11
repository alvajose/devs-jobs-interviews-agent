import "server-only";
import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

type LogLevel = "info" | "warn" | "error";
type LogFields = Record<string, unknown>;

export function getRequestId(req: Request): string {
  const headerValue = req.headers.get("x-request-id")?.trim();
  if (headerValue) return headerValue.slice(0, 128);
  return crypto.randomUUID();
}

export function requestContext(req: Request, requestId: string): LogFields {
  const url = new URL(req.url);
  return {
    request_id: requestId,
    method: req.method,
    path: url.pathname,
  };
}

function writeStructuredLog(level: LogLevel, event: string, fields: LogFields = {}) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  });

  if (level === "error") {
    console.error(entry);
    return;
  }
  if (level === "warn") {
    console.warn(entry);
    return;
  }
  console.info(entry);
}

export function logInfo(event: string, fields: LogFields = {}) {
  writeStructuredLog("info", event, fields);
}

export function logWarn(event: string, fields: LogFields = {}) {
  writeStructuredLog("warn", event, fields);
}

export function logError(event: string, fields: LogFields = {}) {
  writeStructuredLog("error", event, fields);
}

export function errorDetails(error: unknown): LogFields {
  if (error instanceof Error) {
    return {
      error_name: error.name,
      error_message: error.message,
      error_stack: error.stack,
    };
  }
  return { error_message: String(error) };
}

function sentryEnabled() {
  return Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
}

export function captureException(error: unknown, context: LogFields = {}) {
  if (!sentryEnabled()) return;
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context)) {
      if (value === undefined) continue;
      scope.setExtra(key, value as string | number | boolean | object);
    }
    Sentry.captureException(error);
  });
}

export function jsonWithRequestId(
  requestId: string,
  payload: unknown,
  init?: ResponseInit,
) {
  const response = NextResponse.json(payload, init);
  response.headers.set("x-request-id", requestId);
  return response;
}
