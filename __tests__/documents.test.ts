/**
 * Document repository and service orchestration tests.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
import { InventoryService } from '@/src/services/inventoryService';
import { DocumentService } from '@/src/services/documentService';
import { DocumentRepository } from '@/src/repositories/documentRepository';
import { ItemRepository } from '@/src/repositories/itemRepository';
import { ReminderRepository } from '@/src/repositories/reminderRepository';
import { WarrantyRepository } from '@/src/repositories/warrantyRepository';
import { ItemDeletionService } from '@/src/services/itemDeletionService';
import { MockNotificationAdapter } from '@/src/services/notificationAdapter';
import { EMPTY_ITEM_FORM } from '@/src/domain/inventory';
import * as managedFileService from '@/src/services/managedFileService';

jest.mock('@/src/services/managedFileService', () => ({
  importManagedFile: jest.fn(),
  deleteManagedFileByRelativePath: jest.fn(),
  managedUriFromRelativePath: jest.fn(),
}));

const importManagedFile = managedFileService.importManagedFile as jest.Mock;
const deleteManagedFileByRelativePath =
  managedFileService.deleteManagedFileByRelativePath as jest.Mock;

async function seedItem(db: SqlDatabase) {
  const inventory = new InventoryService(db);
  const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
  return inventory.createItem(propertyId, { ...EMPTY_ITEM_FORM, name: 'Fridge' });
}

describe('documents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    deleteManagedFileByRelativePath.mockResolvedValue(true);
  });

  test('create metadata and list by item', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const item = await seedItem(db);
    const documents = new DocumentRepository(db);

    const doc = documents.create({
      itemId: item.id,
      type: 'receipt',
      title: 'Чек',
      filePath: 'documents/a.pdf',
    });

    expect(documents.listByItemId(item.id)).toHaveLength(1);
    expect(doc.filePath).toBe('documents/a.pdf');
  });

  test('global list with search by item name', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const item = await seedItem(db);
    const documents = new DocumentRepository(db);
    const propertyId = item.propertyId;

    documents.create({
      itemId: item.id,
      type: 'manual',
      title: 'Manual',
      filePath: 'documents/m.pdf',
    });

    const rows = documents.listForProperty(propertyId, {
      search: 'Fridge',
      type: 'all',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.itemName).toBe('Fridge');
  });

  test('filter by document type', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const item = await seedItem(db);
    const documents = new DocumentRepository(db);

    documents.create({
      itemId: item.id,
      type: 'receipt',
      title: 'Receipt',
      filePath: 'documents/r.pdf',
    });
    documents.create({
      itemId: item.id,
      type: 'manual',
      title: 'Manual',
      filePath: 'documents/m.pdf',
    });

    const receipts = documents.listForProperty(item.propertyId, {
      search: '',
      type: 'receipt',
    });
    expect(receipts).toHaveLength(1);
    expect(receipts[0]!.document.type).toBe('receipt');
  });

  test('import succeeds and DB succeeds', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const item = await seedItem(db);
    const service = new DocumentService(db);

    importManagedFile.mockResolvedValue({
      uri: 'file:///managed/documents/x.pdf',
      relativePath: 'documents/x.pdf',
      mimeType: 'application/pdf',
      originalName: 'receipt.pdf',
    });

    const doc = await service.createDocument({
      itemId: item.id,
      type: 'receipt',
      title: 'Чек',
      file: { sourceUri: 'file:///picker/receipt.pdf' },
    });

    expect(doc.filePath).toBe('documents/x.pdf');
  });

  test('import succeeds and DB fails cleans up file', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const item = await seedItem(db);
    const service = new DocumentService(db);

    importManagedFile.mockResolvedValue({
      uri: 'file:///managed/documents/y.pdf',
      relativePath: 'documents/y.pdf',
      mimeType: 'application/pdf',
      originalName: null,
    });

    const createSpy = jest
      .spyOn(DocumentRepository.prototype, 'create')
      .mockImplementation(() => {
        throw new Error('db fail');
      });

    await expect(
      service.createDocument({
        itemId: item.id,
        type: 'receipt',
        title: 'Чек',
        file: { sourceUri: 'file:///picker/y.pdf' },
      }),
    ).rejects.toThrow();

    expect(deleteManagedFileByRelativePath).toHaveBeenCalledWith('documents/y.pdf');
    createSpy.mockRestore();
  });

  test('delete DB row then file cleanup', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const item = await seedItem(db);
    const service = new DocumentService(db);
    const documents = new DocumentRepository(db);

    const doc = documents.create({
      itemId: item.id,
      type: 'receipt',
      title: 'Чек',
      filePath: 'documents/z.pdf',
    });

    await service.deleteDocument(doc.id);
    expect(documents.getById(doc.id)).toBeNull();
    expect(deleteManagedFileByRelativePath).toHaveBeenCalledWith('documents/z.pdf');
  });

  test('DB delete failure leaves the managed file untouched', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const item = await seedItem(db);
    const documents = new DocumentRepository(db);
    const doc = documents.create({ itemId: item.id, type: 'receipt', title: 'Receipt', filePath: 'documents/keep.pdf' });
    jest.spyOn(DocumentRepository.prototype, 'delete').mockImplementationOnce(() => { throw new Error('DB failure'); });
    await expect(new DocumentService(db).deleteDocument(doc.id)).rejects.toThrow('DB failure');
    expect(deleteManagedFileByRelativePath).not.toHaveBeenCalled();
    expect(documents.getById(doc.id)).not.toBeNull();
  });

  test('item cascade removes documents', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const item = await seedItem(db);
    const documents = new DocumentRepository(db);

    documents.create({
      itemId: item.id,
      type: 'receipt',
      title: 'Чек',
      filePath: 'documents/c.pdf',
    });

    new ItemRepository(db).deleteItem(item.id);
    expect(db.getFirst('SELECT id FROM documents LIMIT 1')).toBeNull();
  });

  test('item deletion cleans all files, cascades metadata, and cancels notifications', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const item = await seedItem(db);
    db.run('UPDATE items SET primary_photo_path = ? WHERE id = ?', ['photos/main.jpg', item.id]);
    new DocumentRepository(db).create({ itemId: item.id, type: 'receipt', title: 'Receipt', filePath: 'documents/receipt.jpg' });
    new DocumentRepository(db).create({ itemId: item.id, type: 'warranty', title: 'Warranty', filePath: 'documents/warranty.pdf' });
    const warranty = new WarrantyRepository(db).create({ itemId: item.id, type: 'manufacturer', endDate: '2027-01-01' });
    new ReminderRepository(db).create({ itemId: item.id, reminderType: 'warranty', warrantyId: warranty.id, dueAt: '2026-12-01T06:00:00.000Z', notificationId: 'os-1' });
    const notifications = new MockNotificationAdapter();
    await new ItemDeletionService(db, notifications).deleteItemWithFiles(item.id);
    expect(notifications.cancelled).toEqual(['os-1']);
    expect(deleteManagedFileByRelativePath).toHaveBeenCalledWith('photos/main.jpg');
    expect(deleteManagedFileByRelativePath).toHaveBeenCalledWith('documents/receipt.jpg');
    expect(deleteManagedFileByRelativePath).toHaveBeenCalledWith('documents/warranty.pdf');
    for (const table of ['items', 'documents', 'warranties', 'reminders']) {
      expect(db.getFirst(`SELECT id FROM ${table} LIMIT 1`)).toBeNull();
    }
  });
});
