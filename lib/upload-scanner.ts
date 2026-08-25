import { env } from "@/lib/env";

export async function scanUpload(bytes: Uint8Array, filename: string, mimeType: string) {
  if (!env.UPLOAD_SCANNER_URL) {
    if (env.NODE_ENV === "production") throw new Error("Upload malware scanner is not configured.");
    return;
  }
  const response = await fetch(env.UPLOAD_SCANNER_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${env.UPLOAD_SCANNER_TOKEN}`,
      "Content-Type": mimeType,
      "X-Upload-Filename": encodeURIComponent(filename),
    },
    body: Buffer.from(bytes),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("Upload scanner could not verify the file.");
  const result = await response.json() as { safe?: boolean };
  if (result.safe !== true) throw new Error("Upload scanner rejected the file.");
}
