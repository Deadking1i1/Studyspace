import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { studyMaterials } from "@/db/schema";
import { currentUser } from "@/lib/auth/session";
import { studyMaterialStorageKey } from "@/lib/features/materials";
import { getPrivateObject, storageErrorIsNotFound } from "@/lib/storage";

function contentDispositionFilename(filename: string) {
  return filename.replace(/["\\\r\n]/g, "_");
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ materialId: string }> },
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { materialId } = await params;
  const id = Number(materialId);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Study material not found." }, { status: 404 });
  const [material] = await db
    .select()
    .from(studyMaterials)
    .where(and(eq(studyMaterials.id, id), eq(studyMaterials.userId, user.id)))
    .limit(1);
  if (!material) return NextResponse.json({ error: "Study material not found." }, { status: 404 });

  try {
    const file = await getPrivateObject(studyMaterialStorageKey(material));
    return new NextResponse(file, {
      headers: {
        "content-disposition": `attachment; filename="${contentDispositionFilename(material.originalFilename)}"`,
        "content-type": material.mimeType,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (storageErrorIsNotFound(error)) {
      return NextResponse.json({ error: "Study material file is missing from storage." }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Study material storage is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } },
    );
  }
}
