/**
 * Controlled item deletion — DB cascade plus managed file cleanup.
 * SQL CASCADE removes metadata rows; files require explicit deletion.
 */

import { ItemRepository } from '@/src/repositories/itemRepository';
import type { SqlDatabase } from '@/src/db/types';
import { deleteManagedFileByRelativePath } from '@/src/services/managedFileService';

export class ItemDeletionService {
  private readonly items: ItemRepository;

  constructor(db: SqlDatabase) {
    this.items = new ItemRepository(db);
  }

  /**
   * Deletes an item and all linked managed files.
   * Orphan file cleanup is best-effort after the DB transaction succeeds.
   */
  async deleteItemWithFiles(itemId: string): Promise<void> {
    const paths = this.items.listManagedFilePathsForItem(itemId);
    this.items.deleteItem(itemId);
    await Promise.all(paths.map((p) => deleteManagedFileByRelativePath(p)));
  }
}
