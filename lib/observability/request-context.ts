import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";

type RequestContext = { correlationId: string };

const requestContext = new AsyncLocalStorage<RequestContext>();
const SAFE_CORRELATION_ID = /^[A-Za-z0-9._:-]{8,128}$/;

export function correlationIdFrom(request?: Request) {
  const supplied = request?.headers.get("x-request-id")?.trim();
  return supplied && SAFE_CORRELATION_ID.test(supplied) ? supplied : crypto.randomUUID();
}

export function withRequestContext<T>(correlationId: string, operation: () => T) {
  return requestContext.run({ correlationId }, operation);
}

export function currentCorrelationId() {
  return requestContext.getStore()?.correlationId;
}
