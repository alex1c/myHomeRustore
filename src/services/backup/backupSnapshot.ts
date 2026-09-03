/**
 * Consistent DB snapshot for backup — short read transaction, then files copied.
 */

import type { SqlDatabase } from '@/src/db/types';
import type { BackupDataJson, BackupPreviewCounts } from '@/src/domain/backup';
import { BACKUP_SETTINGS_WHITELIST } from '@/src/domain/backup';
import type { ManagedStore } from '@/src/services/backup/managedStore';

export interface BackupSnapshot {
  data: BackupDataJson;
  files: Map<string, Uint8Array>;
  warnings: string[];
  counts: BackupPreviewCounts;
}

function countOf(data: BackupDataJson): BackupPreviewCounts {
  return {
    properties: data.properties.length,
    locations: data.locations.length,
    items: data.items.length,
    purchases: data.purchases.length,
    warranties: data.warranties.length,
    documents: data.documents.length,
    maintenanceRules: data.maintenance_rules.length,
    maintenanceEvents: data.maintenance_events.length,
    consumables: data.consumables.length,
    consumableEvents: data.consumable_events.length,
    reminders: data.reminders.length,
  };
}

/**
 * Read all user tables inside a single transaction for a consistent snapshot.
 * Does not touch managed files yet.
 */
export function readBackupDataSnapshot(db: SqlDatabase): BackupDataJson {
  return db.withTransaction(() => {
    const settingsRows = db.getAll<{ key: string; value: string }>(
      'SELECT key, value FROM app_settings',
    );
    const whitelist = new Set<string>(BACKUP_SETTINGS_WHITELIST);
    const app_settings = settingsRows.filter((row) => whitelist.has(row.key));

    return {
      properties: db.getAll('SELECT * FROM properties ORDER BY id'),
      locations: db.getAll('SELECT * FROM locations ORDER BY id'),
      items: db.getAll('SELECT * FROM items ORDER BY id'),
      purchases: db.getAll('SELECT * FROM purchases ORDER BY id'),
      warranties: db.getAll('SELECT * FROM warranties ORDER BY id'),
      documents: db.getAll('SELECT * FROM documents ORDER BY id'),
      maintenance_rules: db.getAll(
        'SELECT * FROM maintenance_rules ORDER BY id',
      ),
      maintenance_events: db.getAll(
        'SELECT * FROM maintenance_events ORDER BY id',
      ),
      consumables: db.getAll('SELECT * FROM consumables ORDER BY id'),
      consumable_events: db.getAll(
        'SELECT * FROM consumable_events ORDER BY id',
      ),
      reminders: db.getAll('SELECT * FROM reminders ORDER BY id'),
      app_settings,
    };
  });
}

/**
 * Attach managed file bytes to a data snapshot.
 * Missing-file policy: drop broken photo/document references + collect warnings.
 * Never create a backup that restores paths pointing at absent files.
 */
export async function attachManagedFiles(
  data: BackupDataJson,
  store: ManagedStore,
): Promise<BackupSnapshot> {
  const warnings: string[] = [];
  const files = new Map<string, Uint8Array>();

  // Photos referenced by items.
  for (const item of data.items) {
    const path = item.primary_photo_path;
    if (typeof path !== 'string' || !path) continue;
    const bytes = await store.readRelative(path);
    if (!bytes) {
      warnings.push(`Отсутствует фото: ${path}`);
      item.primary_photo_path = null;
      continue;
    }
    files.set(path, bytes);
  }

  // Documents — omit rows whose files are missing.
  const keptDocuments: Record<string, unknown>[] = [];
  for (const doc of data.documents) {
    const path = doc.file_path;
    if (typeof path !== 'string' || !path) {
      warnings.push('Документ без пути пропущен');
      continue;
    }
    const bytes = await store.readRelative(path);
    if (!bytes) {
      warnings.push(`Отсутствует файл документа: ${path}`);
      continue;
    }
    files.set(path, bytes);
    keptDocuments.push(doc);
  }
  data.documents = keptDocuments;

  // Clear OS notification IDs in snapshot — not portable across devices.
  for (const reminder of data.reminders) {
    reminder.notification_id = null;
  }

  return {
    data,
    files,
    warnings,
    counts: countOf(data),
  };
}
