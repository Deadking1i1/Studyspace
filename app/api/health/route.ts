import { healthResponse } from "@/lib/observability/health-response";

export function GET(request: Request) {
  return healthResponse(request);
}
