/**
 * Managed local file storage inside app-owned documentDirectory/managed/.
 * Database stores relative paths only — portable for backup ZIP.
 */

import * as FileSystem from 'expo-file-system/legacy';

import { createEntityIdSync } from '@/src/domain/ids';
import {
  isAllowedManagedRelativePath,
  sanitizeBackupRelativePath,
  sanitizeFileName,
} from '@/src/utils/pathSafety';

const ROOT = `${FileSystem.documentDirectory ?? ''}managed/`;

export type ManagedFileCategory = 'documents' | 'photos';

export interface ManagedFileRef {
  /** Absolute URI under documentDirectory/managed/ (runtime only). */
  uri: string;
  /** Relative path stored in SQLite and backup archives. */
  relativePath: string;
  mimeType: string | null;
  originalName: string | null;
}

function extensionFromName(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx <= 0) {
    return '';
  }
  const extension = name.slice(idx).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : '';
}

async function ensureDir(path: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
}

/** Copy an external/picker URI into managed storage. */
export async function importManagedFile(options: {
  sourceUri: string;
  category: ManagedFileCategory;
  mimeType?: string | null;
  originalName?: string | null;
}): Promise<ManagedFileRef> {
  const safeName = sanitizeFileName(options.originalName?.trim() || 'file');
  const ext = extensionFromName(safeName);
  const id = createEntityIdSync();
  const relativePath = `${options.category}/${id}${ext}`;
  const destUri = `${ROOT}${relativePath}`;

  await ensureDir(`${ROOT}${options.category}/`);
  await FileSystem.copyAsync({ from: options.sourceUri, to: destUri });

  return {
    uri: destUri,
    relativePath,
    mimeType: options.mimeType ?? null,
    originalName: options.originalName ?? null,
  };
}

export function managedUriFromRelativePath(relativePath: string): string | null {
  const safe = sanitizeBackupRelativePath(relativePath);
  if (!safe || !isAllowedManagedRelativePath(safe)) {
    return null;
  }
  return `${ROOT}${safe}`;
}

export async function deleteManagedFileByRelativePath(
  relativePath: string,
): Promise<boolean> {
  const uri = managedUriFromRelativePath(relativePath);
  if (!uri) {
    return false;
  }
  return deleteManagedFile(uri);
}

export async function deleteManagedFile(uri: string): Promise<boolean> {
  try {
    if (!isManagedUri(uri)) return false;
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      return false;
    }
    await FileSystem.deleteAsync(uri, { idempotent: true });
    return true;
  } catch {
    return false;
  }
}

export async function managedFileExists(relativePath: string): Promise<boolean> {
  const uri = managedUriFromRelativePath(relativePath);
  if (!uri) return false;
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists;
}

export function isManagedUri(uri: string): boolean {
  if (!ROOT || !uri.startsWith(ROOT)) return false;
  const relative = uri.slice(ROOT.length);
  const safe = sanitizeBackupRelativePath(relative);
  return safe === relative && isAllowedManagedRelativePath(safe);
}

export function getManagedRoot(): string {
  return ROOT;
}

/** Future backup restore entry point — writes base64 into managed layout. */
export async function restoreManagedFileFromBase64(options: {
  relativePath: string;
  base64: string;
}): Promise<string | null> {
  const safe = sanitizeBackupRelativePath(options.relativePath);
  if (!safe || !isAllowedManagedRelativePath(safe)) {
    return null;
  }
  const destUri = `${ROOT}${safe}`;
  const slash = safe.lastIndexOf('/');
  if (slash > 0) {
    await ensureDir(destUri.substring(0, destUri.lastIndexOf('/')));
  }
  await FileSystem.writeAsStringAsync(destUri, options.base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return safe;
}
