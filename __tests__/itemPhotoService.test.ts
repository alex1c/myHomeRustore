/**
 * Item photo service orchestration tests (mocked file system).
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import { InventoryService } from '@/src/services/inventoryService';
import { ItemPhotoService } from '@/src/services/itemPhotoService';
import * as managedFileService from '@/src/services/managedFileService';
import { ItemRepository } from '@/src/repositories/itemRepository';
import { EMPTY_ITEM_FORM } from '@/src/domain/inventory';

jest.mock('@/src/services/managedFileService', () => ({
  importManagedFile: jest.fn(),
  deleteManagedFileByRelativePath: jest.fn(),
  managedUriFromRelativePath: jest.fn(),
}));

const importManagedFile = managedFileService.importManagedFile as jest.Mock;
const deleteManagedFileByRelativePath =
  managedFileService.deleteManagedFileByRelativePath as jest.Mock;

async function seedItem() {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  const db = createDatabaseFromClient(createSqlJsAdapter(raw));
  const inventory = new InventoryService(db);
  const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
  const item = inventory.createItem(propertyId, {
    ...EMPTY_ITEM_FORM,
    name: 'Test item',
  });
  return { db, item, photos: new ItemPhotoService(db) };
}

describe('itemPhotoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    deleteManagedFileByRelativePath.mockResolvedValue(true);
  });

  test('import on create stores relative path', async () => {
    importManagedFile.mockResolvedValue({
      uri: 'file:///managed/photos/a.jpg',
      relativePath: 'photos/a.jpg',
      mimeType: 'image/jpeg',
      originalName: null,
    });

    const { photos } = await seedItem();
    const path = await photos.importPhotoForNewItem('file:///picker.jpg', 'image/jpeg');
    expect(path).toBe('photos/a.jpg');
    expect(importManagedFile).toHaveBeenCalled();
  });

  test('replace imports new file, updates DB, deletes old', async () => {
    const { db, item, photos } = await seedItem();
    db.run('UPDATE items SET primary_photo_path = ? WHERE id = ?', ['photos/old.jpg', item.id]);

    importManagedFile.mockResolvedValue({
      uri: 'file:///managed/photos/new.jpg',
      relativePath: 'photos/new.jpg',
      mimeType: 'image/jpeg',
      originalName: null,
    });

    const path = await photos.replacePrimaryPhoto(item.id, 'file:///picker-new.jpg');
    expect(path).toBe('photos/new.jpg');
    expect(deleteManagedFileByRelativePath).toHaveBeenCalledWith('photos/old.jpg');
  });

  test('replace rolls back new file when DB update fails', async () => {
    const { item, photos } = await seedItem();

    importManagedFile.mockResolvedValue({
      uri: 'file:///managed/photos/new.jpg',
      relativePath: 'photos/new.jpg',
      mimeType: 'image/jpeg',
      originalName: null,
    });

    jest.spyOn(ItemRepository.prototype, 'updateItem').mockImplementation(() => {
      throw new Error('db fail');
    });

    await expect(
      photos.replacePrimaryPhoto(item.id, 'file:///picker-new.jpg'),
    ).rejects.toThrow();

    expect(deleteManagedFileByRelativePath).toHaveBeenCalledWith('photos/new.jpg');
  });
});
