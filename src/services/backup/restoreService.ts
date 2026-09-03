/**
 * Replace-mode restore from a validated .myhomebackup archive.
 *
 * Atomicity strategy (files + SQLite cannot share one ACID transaction):
 * 1. Fully validate archive (no mutation).
 * 2. Copy backup files to NEW generated managed paths (never overwrite live files).
 * 3. Rewrite relative paths in the in-memory dataset to those new paths.
 * 4. Collect current OS notification IDs (still on old DB).
 * 5. SQLite transaction: DELETE all user tables → INSERT restored rows (FK ON).
 * 6. On DB failure: delete newly written files; old DB/files unchanged.
 * 7. On DB success: cancel old OS notifications; schedule future restored reminders;
 *    best-effort delete old unreferenced managed files; notifyDataReset().
 */

import type { SqlDatabase } from '@/src/db/types';
import type { BackupPreview, BackupPreviewCounts } from '@/src/domain/backup';
import { AppError } from '@/src/domain/errors';
import { createEntityIdSync } from '@/src/domain/ids';
import { unpackBackupArchive } from '@/src/services/backup/backupArchive';
import {
  validateUnpackedBackup,
  type ValidatedBackup,
} from '@/src/services/backup/backupValidator';
import {
  acquireBackupLock,
  releaseBackupLock,
} from '@/src/services/backup/backupLock';
import {
  ExpoManagedStore,
  type ManagedStore,
} from '@/src/services/backup/managedStore';
import { notifyDataReset } from '@/src/services/dataReset';
import type { NotificationAdapter } from '@/src/services/notificationAdapter';
import { ReminderRepository } from '@/src/repositories/reminderRepository';
import {
  isAllowedManagedRelativePath,
  sanitizeBackupRelativePath,
} from '@/src/utils/pathSafety';

export type RestoreResult = {
  counts: BackupPreviewCounts;
  remindersScheduled: number;
  remindersFailed: number;
  permissionDenied: boolean;
  warnings: string[];
};

function extensionOf(path: string): string {
  const base = path.split('/').pop() ?? '';
  const idx = base.lastIndexOf('.');
  if (idx <= 0) return '';
  const ext = base.slice(idx).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : '';
}

function rewriteManagedPath(oldPath: string): string {
  const safe = sanitizeBackupRelativePath(oldPath);
  if (!safe || !isAllowedManagedRelativePath(safe)) {
    throw new AppError('Небезопасный путь при восстановлении', {
      code: 'UNSAFE_PATH',
    });
  }
  const root = safe.split('/')[0]!;
  return `${root}/${createEntityIdSync()}${extensionOf(safe)}`;
}

export class RestoreService {
  private readonly store: ManagedStore;
  private readonly reminders: ReminderRepository;

  constructor(
    private readonly db: SqlDatabase,
    private readonly notifications: NotificationAdapter,
    store?: ManagedStore,
  ) {
    this.store = store ?? new ExpoManagedStore();
    this.reminders = new ReminderRepository(db);
  }

  /** Parse + validate archive bytes into a preview (no mutation). */
  async previewFromBytes(bytes: Uint8Array): Promise<BackupPreview> {
    const unpacked = unpackBackupArchive(bytes);
    const validated = validateUnpackedBackup(unpacked);
    return {
      manifest: validated.manifest,
      counts: validated.counts,
      warnings: validated.warnings,
    };
  }

  async previewFromUri(uri: string): Promise<{
    preview: BackupPreview;
    bytes: Uint8Array;
  }> {
    const bytes = await this.store.readUri(uri);
    const preview = await this.previewFromBytes(bytes);
    return { preview, bytes };
  }

  /** Full replace restore from already-read archive bytes. */
  async restoreFromBytes(bytes: Uint8Array): Promise<RestoreResult> {
    acquireBackupLock('restore');
    const writtenPaths: string[] = [];
    try {
      const unpacked = unpackBackupArchive(bytes);
      const validated = validateUnpackedBackup(unpacked);

      // Snapshot old notification IDs before DB replace.
      const oldNotificationIds = this.listAllNotificationIds();
      const oldManagedPaths = await this.store.listRelativePaths();

      // 2–3. Stage files under fresh paths; rewrite dataset references.
      const pathMap = new Map<string, string>();
      for (const [oldPath, fileBytes] of validated.files) {
        const newPath = rewriteManagedPath(oldPath);
        await this.store.writeRelative(newPath, fileBytes);
        writtenPaths.push(newPath);
        pathMap.set(oldPath, newPath);
      }

      const data = validated.data;
      for (const item of data.items) {
        const photo = item.primary_photo_path;
        if (typeof photo === 'string' && photo) {
          const mapped = pathMap.get(photo);
          if (!mapped) {
            throw new AppError('Файл фото отсутствует в архиве', {
              code: 'MISSING_FILE',
            });
          }
          item.primary_photo_path = mapped;
        }
      }
      for (const doc of data.documents) {
        const path = doc.file_path;
        if (typeof path !== 'string' || !path) {
          throw new AppError('Документ без пути', { code: 'INVALID_DATA' });
        }
        const mapped = pathMap.get(path);
        if (!mapped) {
          throw new AppError('Файл документа отсутствует в архиве', {
            code: 'MISSING_FILE',
          });
        }
        doc.file_path = mapped;
      }
      for (const reminder of data.reminders) {
        reminder.notification_id = null;
      }

      // 5. Replace DB user data atomically.
      try {
        this.db.withTransaction(() => {
          this.deleteAllUserData();
          this.insertAllUserData(data);
        });
      } catch (err) {
        // Compensation: remove staged files; old DB untouched after rollback.
        for (const path of writtenPaths) {
          await this.store.deleteRelative(path);
        }
        throw err instanceof AppError
          ? err
          : new AppError('Не удалось записать данные резервной копии', {
              code: 'DB_RESTORE_FAILED',
              cause: err,
            });
      }

      // 7. Post-commit: cancel old OS notifications (best-effort).
      for (const id of oldNotificationIds) {
        try {
          await this.notifications.cancel(id);
        } catch {
          // ignore
        }
      }

      const schedule = await this.scheduleRestoredReminders();

      // Cleanup old managed files that are no longer referenced.
      const newReferenced = new Set<string>([...pathMap.values()]);
      for (const oldPath of oldManagedPaths) {
        if (!newReferenced.has(oldPath)) {
          await this.store.deleteRelative(oldPath);
        }
      }

      notifyDataReset();

      return {
        counts: validated.counts,
        remindersScheduled: schedule.scheduledCount,
        remindersFailed: schedule.failedCount,
        permissionDenied: schedule.permissionDenied,
        warnings: validated.warnings,
      };
    } finally {
      releaseBackupLock();
    }
  }

  private listAllNotificationIds(): string[] {
    return this.db
      .getAll<{ notification_id: string }>(
        `SELECT notification_id FROM reminders
         WHERE notification_id IS NOT NULL`,
      )
      .map((row) => row.notification_id);
  }

  private deleteAllUserData(): void {
    // Child tables first — FK ON.
    this.db.run('DELETE FROM reminders');
    this.db.run('DELETE FROM consumable_events');
    this.db.run('DELETE FROM maintenance_events');
    this.db.run('DELETE FROM consumables');
    this.db.run('DELETE FROM maintenance_rules');
    this.db.run('DELETE FROM documents');
    this.db.run('DELETE FROM warranties');
    this.db.run('DELETE FROM purchases');
    this.db.run('DELETE FROM items');
    this.db.run('DELETE FROM locations');
    this.db.run('DELETE FROM properties');
    this.db.run('DELETE FROM app_settings');
  }

  private insertAllUserData(data: ValidatedBackup['data']): void {
    for (const row of data.properties) {
      this.db.run(
        `INSERT INTO properties (id, name, type, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.name,
          row.type,
          row.note ?? null,
          row.created_at,
          row.updated_at,
        ],
      );
    }
    for (const row of sortLocationsForInsert(data.locations)) {
      this.db.run(
        `INSERT INTO locations
         (id, property_id, parent_location_id, name, sort_order, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.property_id,
          row.parent_location_id ?? null,
          row.name,
          row.sort_order ?? 0,
          row.note ?? null,
          row.created_at,
          row.updated_at,
        ],
      );
    }
    for (const row of data.items) {
      this.db.run(
        `INSERT INTO items
         (id, property_id, location_id, category, name, brand, model, serial_number,
          note, primary_photo_path, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.property_id,
          row.location_id ?? null,
          row.category,
          row.name,
          row.brand ?? null,
          row.model ?? null,
          row.serial_number ?? null,
          row.note ?? null,
          row.primary_photo_path ?? null,
          row.status ?? 'active',
          row.created_at,
          row.updated_at,
        ],
      );
    }
    for (const row of data.purchases) {
      this.db.run(
        `INSERT INTO purchases
         (id, item_id, purchase_date, seller, price_minor, currency, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.item_id,
          row.purchase_date ?? null,
          row.seller ?? null,
          row.price_minor ?? null,
          row.currency ?? 'RUB',
          row.note ?? null,
          row.created_at,
          row.updated_at,
        ],
      );
    }
    for (const row of data.warranties) {
      this.db.run(
        `INSERT INTO warranties
         (id, item_id, type, provider, start_date, end_date, duration_months, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.item_id,
          row.type,
          row.provider ?? null,
          row.start_date ?? null,
          row.end_date ?? null,
          row.duration_months ?? null,
          row.note ?? null,
          row.created_at,
          row.updated_at,
        ],
      );
    }
    for (const row of data.documents) {
      this.db.run(
        `INSERT INTO documents
         (id, item_id, type, title, file_path, mime_type, original_name, file_size, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.item_id,
          row.type,
          row.title,
          row.file_path,
          row.mime_type ?? null,
          row.original_name ?? null,
          row.file_size ?? null,
          row.created_at,
          row.updated_at,
        ],
      );
    }
    for (const row of data.maintenance_rules) {
      this.db.run(
        `INSERT INTO maintenance_rules
         (id, item_id, title, interval_value, interval_unit, last_completed_date,
          next_due_date, enabled, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.item_id,
          row.title,
          row.interval_value ?? null,
          row.interval_unit ?? null,
          row.last_completed_date ?? null,
          row.next_due_date ?? null,
          row.enabled ?? 1,
          row.note ?? null,
          row.created_at,
          row.updated_at,
        ],
      );
    }
    for (const row of data.consumables) {
      this.db.run(
        `INSERT INTO consumables
         (id, item_id, name, model_or_article, manufacturer,
          replacement_interval_value, replacement_interval_unit,
          last_replaced_date, next_due_date, stock_quantity, stock_unit,
          price_minor, note, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.item_id,
          row.name,
          row.model_or_article ?? null,
          row.manufacturer ?? null,
          row.replacement_interval_value ?? null,
          row.replacement_interval_unit ?? null,
          row.last_replaced_date ?? null,
          row.next_due_date ?? null,
          row.stock_quantity ?? null,
          row.stock_unit ?? null,
          row.price_minor ?? null,
          row.note ?? null,
          row.active ?? 1,
          row.created_at,
          row.updated_at,
        ],
      );
    }
    for (const row of data.maintenance_events) {
      this.db.run(
        `INSERT INTO maintenance_events
         (id, item_id, maintenance_rule_id, performed_at, cost_minor, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.item_id,
          row.maintenance_rule_id ?? null,
          row.performed_at,
          row.cost_minor ?? null,
          row.note ?? null,
          row.created_at,
          row.updated_at,
        ],
      );
    }
    for (const row of data.consumable_events) {
      this.db.run(
        `INSERT INTO consumable_events
         (id, item_id, consumable_id, event_type, replaced_at,
          quantity_delta, stock_before, stock_after, cost_minor, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.item_id,
          row.consumable_id,
          row.event_type ?? 'replacement',
          row.replaced_at,
          row.quantity_delta ?? null,
          row.stock_before ?? null,
          row.stock_after ?? null,
          row.cost_minor ?? null,
          row.note ?? null,
          row.created_at,
          row.updated_at,
        ],
      );
    }
    for (const row of data.reminders) {
      this.db.run(
        `INSERT INTO reminders
         (id, item_id, reminder_type, warranty_id, maintenance_rule_id, consumable_id,
          due_at, notification_id, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
        [
          row.id,
          row.item_id,
          row.reminder_type,
          row.warranty_id ?? null,
          row.maintenance_rule_id ?? null,
          row.consumable_id ?? null,
          row.due_at,
          row.enabled ?? 1,
          row.created_at,
          row.updated_at,
        ],
      );
    }
    for (const row of data.app_settings) {
      this.db.run(
        `INSERT INTO app_settings (key, value) VALUES (?, ?)`,
        [row.key, row.value],
      );
    }
  }

  /**
   * Schedule OS notifications for restored reminder rows with future due_at.
   * Does not prompt for permission (ensurePermission may return false).
   */
  private async scheduleRestoredReminders(): Promise<{
    scheduledCount: number;
    failedCount: number;
    permissionDenied: boolean;
  }> {
    const rows = this.db.getAll<{
      id: string;
      item_id: string;
      reminder_type: string;
      warranty_id: string | null;
      maintenance_rule_id: string | null;
      consumable_id: string | null;
      due_at: string;
      enabled: number;
    }>(
      `SELECT id, item_id, reminder_type, warranty_id, maintenance_rule_id,
              consumable_id, due_at, enabled
       FROM reminders WHERE enabled = 1`,
    );

    const now = Date.now();
    const future = rows.filter((row) => {
      const t = Date.parse(row.due_at);
      return Number.isFinite(t) && t > now;
    });

    if (future.length === 0) {
      return { scheduledCount: 0, failedCount: 0, permissionDenied: false };
    }

    const allowed = await this.notifications.ensurePermission();
    if (!allowed) {
      return {
        scheduledCount: 0,
        failedCount: 0,
        permissionDenied: true,
      };
    }

    let scheduledCount = 0;
    let failedCount = 0;

    for (const row of future) {
      const item = this.db.getFirst<{ name: string }>(
        'SELECT name FROM items WHERE id = ?',
        [row.item_id],
      );
      const itemName = item?.name ?? 'Вещь';
      const fireAt = new Date(row.due_at);
      const { title, body } = reminderCopy(row.reminder_type, itemName);
      let notificationId: string | null = null;
      try {
        notificationId = await this.notifications.schedule({
          title,
          body,
          fireAt,
          data: {
            itemId: row.item_id,
            ...(row.warranty_id ? { warrantyId: row.warranty_id } : {}),
            ...(row.maintenance_rule_id
              ? { maintenanceRuleId: row.maintenance_rule_id }
              : {}),
            ...(row.consumable_id ? { consumableId: row.consumable_id } : {}),
          },
        });
        this.reminders.updateNotificationState(row.id, notificationId, true);
        scheduledCount += 1;
      } catch {
        failedCount += 1;
        if (notificationId) {
          try {
            await this.notifications.cancel(notificationId);
          } catch {
            // ignore
          }
        }
      }
    }

    return { scheduledCount, failedCount, permissionDenied: false };
  }
}

/** Parents before children so FK parent_location_id succeeds with FK ON. */
function sortLocationsForInsert(
  locations: Record<string, unknown>[],
): Record<string, unknown>[] {
  const remaining = [...locations];
  const ordered: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  while (remaining.length > 0) {
    const batch = remaining.filter((row) => {
      const parent = row.parent_location_id;
      return parent == null || parent === '' || seen.has(String(parent));
    });
    if (batch.length === 0) {
      throw new AppError('Циклические комнаты в резервной копии', {
        code: 'INVALID_RELATION',
      });
    }
    for (const row of batch) {
      ordered.push(row);
      seen.add(String(row.id));
    }
    for (const row of batch) {
      const idx = remaining.indexOf(row);
      if (idx >= 0) remaining.splice(idx, 1);
    }
  }
  return ordered;
}

function reminderCopy(
  type: string,
  itemName: string,
): { title: string; body: string } {
  if (type === 'warranty') {
    return {
      title: 'Скоро закончится гарантия',
      body: `Проверьте гарантию: ${itemName}.`,
    };
  }
  if (type === 'maintenance') {
    return {
      title: 'Пора провести обслуживание',
      body: `Обслуживание для «${itemName}».`,
    };
  }
  if (type === 'consumable') {
    return {
      title: 'Пора заменить расходник',
      body: `Расходник для «${itemName}».`,
    };
  }
  return {
    title: 'Напоминание',
    body: itemName,
  };
}
