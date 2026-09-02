/**
 * Warranty repository CRUD and multiple-warranty tests.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
import { ItemRepository } from '@/src/repositories/itemRepository';
import { PropertyRepository } from '@/src/repositories/propertyRepository';
import { ReminderRepository } from '@/src/repositories/reminderRepository';
import { WarrantyRepository } from '@/src/repositories/warrantyRepository';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  return createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
}

async function seedItem(db: SqlDatabase) {
  const home = new PropertyRepository(db).listProperties()[0]!;
  const item = new ItemRepository(db).createItem({
    propertyId: home.id,
    name: 'Vacuum',
  });
  return item;
}

describe('warranties', () => {
  test('create with duration stores months not end date', async () => {
    const db = await openTestDb();
    const item = await seedItem(db);
    const warranties = new WarrantyRepository(db);

    const w = warranties.create({
      itemId: item.id,
      type: 'manufacturer',
      provider: 'LG',
      startDate: '2026-01-31',
      durationMonths: 1,
    });

    expect(w.endDate).toBeNull();
    expect(w.durationMonths).toBe(1);
    expect(w.provider).toBe('LG');
  });

  test('multiple warranties on same item', async () => {
    const db = await openTestDb();
    const item = await seedItem(db);
    const warranties = new WarrantyRepository(db);

    warranties.create({
      itemId: item.id,
      type: 'manufacturer',
      startDate: '2026-01-01',
      durationMonths: 24,
    });
    warranties.create({
      itemId: item.id,
      type: 'store',
      provider: 'DNS',
      endDate: '2030-01-01',
    });

    expect(warranties.listByItemId(item.id)).toHaveLength(2);
  });

  test('edit updates fields', async () => {
    const db = await openTestDb();
    const item = await seedItem(db);
    const warranties = new WarrantyRepository(db);

    const created = warranties.create({
      itemId: item.id,
      type: 'manufacturer',
      durationMonths: 12,
      startDate: '2026-01-01',
    });

    const updated = warranties.update(created.id, {
      type: 'extended',
      provider: 'Shop',
      endDate: '2028-06-01',
      clearDuration: true,
    });

    expect(updated.type).toBe('extended');
    expect(updated.endDate).toBe('2028-06-01');
    expect(updated.durationMonths).toBeNull();
  });

  test('delete removes warranty', async () => {
    const db = await openTestDb();
    const item = await seedItem(db);
    const warranties = new WarrantyRepository(db);

    const w = warranties.create({
      itemId: item.id,
      type: 'other',
      endDate: '2027-01-01',
    });
    warranties.delete(w.id);
    expect(warranties.getById(w.id)).toBeNull();
  });

  test('item delete cascades warranties and reminders', async () => {
    const db = await openTestDb();
    const item = await seedItem(db);
    const warranties = new WarrantyRepository(db);
    const items = new ItemRepository(db);

    const w = warranties.create({
      itemId: item.id,
      type: 'manufacturer',
      endDate: '2027-01-01',
    });

    new ReminderRepository(db).create({
      itemId: item.id,
      reminderType: 'warranty',
      warrantyId: w.id,
      dueAt: '2026-12-01T09:00:00.000Z',
    });

    items.deleteItem(item.id);

    expect(db.getFirst('SELECT id FROM warranties WHERE id = ?', [w.id])).toBeNull();
    expect(db.getFirst('SELECT id FROM reminders WHERE warranty_id = ?', [w.id])).toBeNull();
  });

  test('rejects both duration and explicit end date on create', async () => {
    const db = await openTestDb();
    const item = await seedItem(db);
    const warranties = new WarrantyRepository(db);

    expect(() =>
      warranties.create({
        itemId: item.id,
        type: 'manufacturer',
        endDate: '2028-01-01',
        durationMonths: 12,
      }),
    ).toThrow();
  });

  test('provider is optional', async () => {
    const db = await openTestDb();
    const item = await seedItem(db);
    const warranties = new WarrantyRepository(db);

    const w = warranties.create({
      itemId: item.id,
      type: 'manufacturer',
      endDate: '2028-01-01',
    });
    expect(w.provider).toBeNull();
  });
});
