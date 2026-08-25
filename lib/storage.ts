import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

let client: S3Client | null = null;
const storageOperationTimeoutMs = 15_000;

function s3() {
  if (!client) {
    client = new S3Client({
      region: env.STORAGE_REGION,
      endpoint: env.STORAGE_ENDPOINT_URL,
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
      credentials: { accessKeyId: env.STORAGE_ACCESS_KEY_ID, secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY },
    });
  }
  return client;
}

function validatedStorageKey(key: string) {
  if (!/^(?:profile-images|study-materials)\/[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(key)) {
    throw new Error("Invalid storage key.");
  }
  return key;
}

function safeLocalPath(key: string) {
  const root = path.resolve(process.cwd(), "storage");
  const target = path.resolve(root, validatedStorageKey(key));
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error("Invalid storage key.");
  return target;
}

export function storageErrorIsNotFound(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate.code === "ENOENT"
    || candidate.name === "NoSuchKey"
    || candidate.name === "NotFound"
    || candidate.$metadata?.httpStatusCode === 404;
}

export async function putPrivateObject(key: string, bytes: Uint8Array, contentType: string) {
  validatedStorageKey(key);
  if (env.STORAGE_BACKEND === "s3") {
    await s3().send(
      new PutObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key, Body: bytes, ContentType: contentType, ServerSideEncryption: "AES256" }),
      { abortSignal: AbortSignal.timeout(storageOperationTimeoutMs) },
    );
    return;
  }
  const target = safeLocalPath(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: "wx" });
}

export async function getPrivateObject(key: string) {
  validatedStorageKey(key);
  if (env.STORAGE_BACKEND === "s3") {
    const result = await s3().send(
      new GetObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }),
      { abortSignal: AbortSignal.timeout(storageOperationTimeoutMs) },
    );
    if (!result.Body) throw new Error("Stored object has no body.");
    return new Uint8Array(await result.Body.transformToByteArray());
  }
  return new Uint8Array(await readFile(safeLocalPath(key)));
}

export async function deletePrivateObject(key: string) {
  validatedStorageKey(key);
  if (env.STORAGE_BACKEND === "s3") {
    await s3().send(
      new DeleteObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }),
      { abortSignal: AbortSignal.timeout(storageOperationTimeoutMs) },
    );
    return;
  }
  await unlink(safeLocalPath(key)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}
