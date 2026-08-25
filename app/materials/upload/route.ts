import { NextRequest, NextResponse } from "next/server";
import { maxMaterialSizeBytes, uploadStudyMaterial } from "@/lib/features/materials";

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxMaterialSizeBytes + 256 * 1024) {
    return NextResponse.redirect(new URL("/materials?error=Study%20materials%20must%20be%2025%20MB%20or%20smaller.", request.url), 303);
  }
  return uploadStudyMaterial(await request.formData());
}
