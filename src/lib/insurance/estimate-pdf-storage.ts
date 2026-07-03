import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "estimates");

export function estimatePdfStorageKey(tenantId: string, estimateId: string) {
  return `${tenantId}/${estimateId}.pdf`;
}

export function resolveEstimatePdfPath(storageKey: string) {
  const normalized = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, "");
  const fullPath = path.join(STORAGE_ROOT, normalized);
  if (!fullPath.startsWith(STORAGE_ROOT)) {
    throw new Error("Invalid storage key");
  }
  return fullPath;
}

export async function writeEstimatePdf(
  tenantId: string,
  estimateId: string,
  bytes: Uint8Array,
): Promise<string> {
  const storageKey = estimatePdfStorageKey(tenantId, estimateId);
  const filePath = resolveEstimatePdfPath(storageKey);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
  return storageKey;
}

export async function readEstimatePdf(storageKey: string): Promise<Buffer | null> {
  try {
    const filePath = resolveEstimatePdfPath(storageKey);
    return await readFile(filePath);
  } catch {
    return null;
  }
}

export function estimatePdfDownloadPath(estimateId: string) {
  return `/api/estimates/${estimateId}/pdf`;
}
