import { readFile } from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { studyMaterials } from "@/db/schema";
import { currentUser } from "@/lib/auth/session";

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
  const [material] = await db
    .select()
    .from(studyMaterials)
    .where(and(eq(studyMaterials.id, id), eq(studyMaterials.userId, user.id)))
    .limit(1);
  if (!material) return NextResponse.json({ error: "Study material not found." }, { status: 404 });

  try {
    const file = await readFile(material.storagePath);
    return new NextResponse(file, {
      headers: {
        "content-disposition": `attachment; filename="${contentDispositionFilename(material.originalFilename)}"`,
        "content-type": material.mimeType,
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Study material file is missing from storage." }, { status: 404 });
  }
}
