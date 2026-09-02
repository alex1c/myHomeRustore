/**
 * Controlled item deletion — DB cascade plus managed file cleanup.
 * SQL CASCADE removes metadata rows; files require explicit deletion.
 */

import { ItemRepository } from '@/src/repositories/itemRepository';
import type { SqlDatabase } from '@/src/db/types';
import { deleteManagedFileByRelativePath } from '@/src/services/managedFileService';
import { ReminderRepository } from '@/src/repositories/reminderRepository';
import type { NotificationAdapter } from '@/src/services/notificationAdapter';

export class ItemDeletionService {
  private readonly items: ItemRepository;
  private readonly reminders: ReminderRepository;

  constructor(db: SqlDatabase, private readonly notifications: NotificationAdapter) {
    this.items = new ItemRepository(db);
    this.reminders = new ReminderRepository(db);
  }

  /**
   * Deletes an item and all linked managed files.
   * Orphan file cleanup is best-effort after the DB transaction succeeds.
   */
  async deleteItemWithFiles(itemId: string): Promise<void> {
    const paths = this.items.listManagedFilePathsForItem(itemId);
    const notificationIds = this.reminders.listNotificationIdsByItemId(itemId);
    this.items.deleteItem(itemId);
    await Promise.allSettled([
      ...paths.map((p) => deleteManagedFileByRelativePath(p)),
      ...notificationIds.map((id) => this.notifications.cancel(id)),
    ]);
  }
}
