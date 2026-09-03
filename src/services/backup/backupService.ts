/**
 * Create .myhomebackup archives and share them via the system sheet.
 */

import * as Sharing from 'expo-sharing';

import {
  BACKUP_EXTENSION,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  type BackupManifest,
} from '@/src/domain/backup';
import { AppError } from '@/src/domain/errors';
import { createEntityIdSync } from '@/src/domain/ids';
import { CURRENT_SCHEMA_VERSION } from '@/src/db/migrations';
import type { SqlDatabase } from '@/src/db/types';
import { appEnvironment } from '@/src/config/environment';
import { packBackupArchive } from '@/src/services/backup/backupArchive';
import {
  acquireBackupLock,
  releaseBackupLock,
} from '@/src/services/backup/backupLock';
import {
  attachManagedFiles,
  readBackupDataSnapshot,
} from '@/src/services/backup/backupSnapshot';
import {
  ExpoManagedStore,
  type ManagedStore,
} from '@/src/services/backup/managedStore';
import { toLocalDateOnly } from '@/src/utils/datetime';

export type BackupCreateResult = {
  uri: string;
  fileName: string;
  warnings: string[];
};

export class BackupService {
  private readonly store: ManagedStore;

  constructor(
    private readonly db: SqlDatabase,
    store?: ManagedStore,
  ) {
    this.store = store ?? new ExpoManagedStore();
  }

  /** Build archive bytes without sharing (testable). */
  async createArchiveBytes(): Promise<{
    bytes: Uint8Array;
    fileName: string;
    warnings: string[];
    manifest: BackupManifest;
  }> {
    acquireBackupLock('backup');
    try {
      const raw = readBackupDataSnapshot(this.db);
      const snapshot = await attachManagedFiles(raw, this.store);
      const backupId = createEntityIdSync();
      const createdAt = new Date().toISOString();
      const manifest: BackupManifest = {
        format: BACKUP_FORMAT,
        formatVersion: BACKUP_FORMAT_VERSION,
        createdAt,
        appVersion: appEnvironment.appVersion,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        backupId,
        counts: snapshot.counts,
        fileCount: snapshot.files.size,
        warnings: snapshot.warnings,
      };
      const bytes = packBackupArchive({
        manifest,
        data: snapshot.data,
        files: snapshot.files,
      });
      const fileName = `my-home-backup-${toLocalDateOnly()}.${BACKUP_EXTENSION}`;
      return { bytes, fileName, warnings: snapshot.warnings, manifest };
    } finally {
      releaseBackupLock();
    }
  }

  /**
   * Create archive, write temp file, open system share sheet, then cleanup.
   */
  async createAndShare(): Promise<BackupCreateResult> {
    acquireBackupLock('backup');
    let uri: string | null = null;
    try {
      const raw = readBackupDataSnapshot(this.db);
      const snapshot = await attachManagedFiles(raw, this.store);
      const backupId = createEntityIdSync();
      const createdAt = new Date().toISOString();
      const manifest: BackupManifest = {
        format: BACKUP_FORMAT,
        formatVersion: BACKUP_FORMAT_VERSION,
        createdAt,
        appVersion: appEnvironment.appVersion,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        backupId,
        counts: snapshot.counts,
        fileCount: snapshot.files.size,
        warnings: snapshot.warnings,
      };
      const bytes = packBackupArchive({
        manifest,
        data: snapshot.data,
        files: snapshot.files,
      });
      const fileName = `my-home-backup-${toLocalDateOnly()}.${BACKUP_EXTENSION}`;
      uri = await this.store.writeTempArchive(fileName, bytes);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/octet-stream',
          dialogTitle: 'Сохранить резервную копию',
          UTI: 'public.data',
        });
      }
      return { uri, fileName, warnings: snapshot.warnings };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('Не удалось создать резервную копию', {
        code: 'BACKUP_FAILED',
        cause: err,
      });
    } finally {
      if (uri) {
        await this.store.deleteUri(uri);
      }
      releaseBackupLock();
    }
  }
}
