/**
 * ZIP pack/unpack for .myhomebackup using fflate (pure JS, Expo-safe).
 */

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

import {
  BACKUP_FORMAT,
  BACKUP_MAX_ARCHIVE_BYTES,
  BACKUP_MAX_ENTRIES,
  BACKUP_MAX_UNCOMPRESSED_BYTES,
  type BackupDataJson,
  type BackupManifest,
} from '@/src/domain/backup';
import { AppError } from '@/src/domain/errors';
import {
  isAllowedManagedRelativePath,
  sanitizeBackupRelativePath,
} from '@/src/utils/pathSafety';

export interface UnpackedBackup {
  manifest: BackupManifest;
  data: BackupDataJson;
  /** Map of managed relative path (photos/…, documents/…) → bytes. */
  files: Map<string, Uint8Array>;
}

function assertSafeArchiveEntry(name: string): string {
  const safe = sanitizeBackupRelativePath(name);
  if (!safe || safe !== name.replace(/\\/g, '/')) {
    throw new AppError('Небезопасный путь в архиве', { code: 'UNSAFE_PATH' });
  }
  return safe;
}

function isAllowedEntry(name: string): boolean {
  if (name === 'manifest.json' || name === 'data.json') return true;
  if (name.startsWith('files/')) {
    const relative = name.slice('files/'.length);
    return isAllowedManagedRelativePath(relative);
  }
  return false;
}

/** Pack manifest + data + managed files into ZIP bytes. */
export function packBackupArchive(input: {
  manifest: BackupManifest;
  data: BackupDataJson;
  files: Map<string, Uint8Array>;
}): Uint8Array {
  const tree: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify(input.manifest, null, 2)),
    'data.json': strToU8(JSON.stringify(input.data)),
  };

  for (const [relative, bytes] of input.files) {
    const safe = sanitizeBackupRelativePath(relative);
    if (!safe || !isAllowedManagedRelativePath(safe)) {
      throw new AppError('Небезопасный путь файла', { code: 'UNSAFE_PATH' });
    }
    // Photos/PDFs are already compressed — store store-only (level 0).
    tree[`files/${safe}`] = bytes;
  }

  return zipSync(tree, { level: 1 });
}

/** Unpack and structurally validate archive entries (not full domain validation). */
export function unpackBackupArchive(bytes: Uint8Array): UnpackedBackup {
  if (bytes.byteLength > BACKUP_MAX_ARCHIVE_BYTES) {
    throw new AppError('Архив слишком большой', { code: 'ZIP_TOO_LARGE' });
  }

  let unzipped: Record<string, Uint8Array>;
  let entryCount = 0;
  let declaredTotal = 0;
  const entryNames = new Set<string>();
  try {
    unzipped = unzipSync(bytes, {
      filter: (entry) => {
        entryCount += 1;
        declaredTotal += entry.originalSize;
        const safeName = assertSafeArchiveEntry(entry.name);
        if (entryNames.has(safeName)) {
          throw new AppError('Дублирующаяся запись в архиве', {
            code: 'DUPLICATE_ENTRY',
          });
        }
        entryNames.add(safeName);
        if (
          entryCount > BACKUP_MAX_ENTRIES ||
          declaredTotal > BACKUP_MAX_UNCOMPRESSED_BYTES
        ) {
          throw new AppError('Архив слишком большой', { code: 'ZIP_TOO_LARGE' });
        }
        if (!isAllowedEntry(safeName)) {
          throw new AppError(`Неподдерживаемый файл в архиве: ${safeName}`, {
            code: 'UNEXPECTED_ENTRY',
          });
        }
        return true;
      },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Файл не является корректным ZIP-архивом', {
      code: 'INVALID_ZIP',
    });
  }

  const names = Object.keys(unzipped);
  if (names.length > BACKUP_MAX_ENTRIES) {
    throw new AppError('Слишком много файлов в архиве', { code: 'ZIP_TOO_LARGE' });
  }

  let total = 0;
  for (const name of names) {
    const data = unzipped[name]!;
    total += data.byteLength;
    if (total > BACKUP_MAX_UNCOMPRESSED_BYTES) {
      throw new AppError('Архив слишком большой', { code: 'ZIP_TOO_LARGE' });
    }
    const safeName = assertSafeArchiveEntry(name);
    if (!isAllowedEntry(safeName)) {
      throw new AppError(`Неподдерживаемый файл в архиве: ${safeName}`, {
        code: 'UNEXPECTED_ENTRY',
      });
    }
  }

  const manifestBytes = unzipped['manifest.json'];
  const dataBytes = unzipped['data.json'];
  if (!manifestBytes) {
    throw new AppError('В архиве нет manifest.json', { code: 'MISSING_MANIFEST' });
  }
  if (!dataBytes) {
    throw new AppError('В архиве нет data.json', { code: 'MISSING_DATA' });
  }

  let manifest: BackupManifest;
  let data: BackupDataJson;
  try {
    manifest = JSON.parse(strFromU8(manifestBytes)) as BackupManifest;
  } catch {
    throw new AppError('Некорректный manifest.json', { code: 'INVALID_JSON' });
  }
  try {
    data = JSON.parse(strFromU8(dataBytes)) as BackupDataJson;
  } catch {
    throw new AppError('Некорректный data.json', { code: 'INVALID_JSON' });
  }

  if (manifest.format !== BACKUP_FORMAT) {
    throw new AppError('Это не резервная копия «Мой дом»', {
      code: 'WRONG_FORMAT',
    });
  }

  const files = new Map<string, Uint8Array>();
  for (const [name, fileBytes] of Object.entries(unzipped)) {
    if (!name.startsWith('files/')) continue;
    const relative = name.slice('files/'.length);
    const safe = sanitizeBackupRelativePath(relative);
    if (!safe || !isAllowedManagedRelativePath(safe)) {
      throw new AppError('Небезопасный путь файла в архиве', {
        code: 'UNSAFE_PATH',
      });
    }
    files.set(safe, fileBytes);
  }

  return { manifest, data, files };
}
