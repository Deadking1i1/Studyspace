import { NextResponse } from "next/server";
import {
  checkReadiness,
  type ReadinessResult,
} from "@/lib/observability/health";
import { logger } from "@/lib/observability/logger";
import {
  correlationIdFrom,
  withRequestContext,
} from "@/lib/observability/request-context";

type ReadinessCheck = () => Promise<ReadinessResult>;

export async function healthResponse(
  request: Request,
  readinessCheck: ReadinessCheck = checkReadiness,
) {
  const correlationId = correlationIdFrom(request);
  return withRequestContext(correlationId, async () => {
    const probe = new URL(request.url).searchParams.get("probe");
    const headers = {
      "Cache-Control": "no-store",
      "X-Request-Id": correlationId,
    };
    if (probe === "live") {
      return NextResponse.json({ status: "ok" }, { headers });
    }

    let readiness: ReadinessResult;
    try {
      readiness = await readinessCheck();
    } catch (error) {
      logger.error("health.readiness_error", { error });
      readiness = { ready: false, checks: { database: "down" } };
    }
    if (!readiness.ready) {
      logger.warn("health.readiness_failed", { checks: readiness.checks });
    }
    return NextResponse.json(
      {
        status: readiness.ready ? "ok" : "unavailable",
        checks: readiness.checks,
      },
      { status: readiness.ready ? 200 : 503, headers },
    );
  });
}
