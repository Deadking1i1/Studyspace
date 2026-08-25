import { ExternalServiceError } from "./external-service";

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_TIMEOUT_MS = 30_000;

function boundedTimeout(timeoutMs: number) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.floor(timeoutMs), MAX_TIMEOUT_MS);
}

export async function withTimeout<T>(
  operation: PromiseLike<T>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  label = "operation",
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ExternalServiceError(label)),
      boundedTimeout(timeoutMs),
    );
  });
  try {
    return await Promise.race([Promise.resolve(operation), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function fetchWithTimeout(
  service: string,
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    boundedTimeout(timeoutMs),
  );
  const abortParent = () => controller.abort();
  if (init.signal?.aborted) {
    controller.abort(init.signal.reason);
  } else {
    init.signal?.addEventListener("abort", abortParent, { once: true });
  }
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof ExternalServiceError) throw error;
    throw new ExternalServiceError(service, { cause: error });
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abortParent);
  }
}
