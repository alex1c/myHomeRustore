/**
 * Safe primary-photo lifecycle for inventory items.
 */

import { AppError } from '@/src/domain/errors';
import { ItemRepository } from '@/src/repositories/itemRepository';
import type { SqlDatabase } from '@/src/db/types';
import {
  deleteManagedFileByRelativePath,
  importManagedFile,
} from '@/src/services/managedFileService';

export class ItemPhotoService {
  private readonly items: ItemRepository;

  constructor(db: SqlDatabase) {
    this.items = new ItemRepository(db);
  }

  /** Import picker URI and attach as primary photo on create. */
  async importPhotoForNewItem(sourceUri: string, mimeType?: string | null): Promise<string> {
    try {
      const ref = await importManagedFile({
        sourceUri,
        category: 'photos',
        mimeType: mimeType ?? null,
      });
      return ref.relativePath;
    } catch {
      throw new AppError('Не удалось сохранить фотографию');
    }
  }

  /**
   * Replace primary photo: import new file, update DB, delete old file only after success.
   * On DB failure, cleans up the newly imported file and keeps the old photo.
   */
  async replacePrimaryPhoto(
    itemId: string,
    sourceUri: string,
    mimeType?: string | null,
  ): Promise<string> {
    const item = this.items.getById(itemId);
    if (!item) {
      throw new AppError('Вещь не найдена', { code: 'NOT_FOUND' });
    }

    const oldPath = item.primaryPhotoPath;
    let newPath: string;
    try {
      const ref = await importManagedFile({
        sourceUri,
        category: 'photos',
        mimeType: mimeType ?? null,
      });
      newPath = ref.relativePath;
    } catch {
      throw new AppError('Не удалось сохранить фотографию');
    }

    try {
      this.items.updateItem(itemId, { primaryPhotoPath: newPath });
    } catch (err) {
      await deleteManagedFileByRelativePath(newPath);
      throw err;
    }

    if (oldPath) {
      await deleteManagedFileByRelativePath(oldPath);
    }
    return newPath;
  }

  /** Remove primary photo from DB, then delete managed file. */
  async removePrimaryPhoto(itemId: string): Promise<void> {
    const item = this.items.getById(itemId);
    if (!item?.primaryPhotoPath) {
      return;
    }
    const oldPath = item.primaryPhotoPath;
    this.items.updateItem(itemId, { clearPhoto: true });
    await deleteManagedFileByRelativePath(oldPath);
  }

  /** Best-effort cleanup when a DB transaction fails after photo import. */
  async cleanupImportedPhoto(relativePath: string): Promise<void> {
    await deleteManagedFileByRelativePath(relativePath);
  }
}
