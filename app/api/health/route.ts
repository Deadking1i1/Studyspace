import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "study-space",
    stack: "next-typescript",
  });
}
