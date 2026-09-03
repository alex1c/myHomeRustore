/**
 * Consumable CRUD, stock, and mark-replaced tests.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import { CURRENT_SCHEMA_VERSION } from '@/src/db/migrations';
import { EMPTY_ITEM_FORM } from '@/src/domain/inventory';
import { EMPTY_CONSUMABLE_FORM } from '@/src/domain/consumables';
import { InventoryService } from '@/src/services/inventoryService';
import { ConsumableService } from '@/src/services/consumableService';
import { MockNotificationAdapter } from '@/src/services/notificationAdapter';
import { ItemRepository } from '@/src/repositories/itemRepository';

async function seed() {
  const SQL = await initSqlJs();
  const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
  expect(db.getUserVersion()).toBe(CURRENT_SCHEMA_VERSION);
  const inventory = new InventoryService(db);
  const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
  const item = inventory.createItem(propertyId, {
    ...EMPTY_ITEM_FORM,
    name: 'Робот-пылесос Dreame',
  });
  const notifications = new MockNotificationAdapter();
  const service = new ConsumableService(db, notifications);
  return { db, item, service, notifications, propertyId };
}

describe('consumables', () => {
  test('create without stock and with schedule', async () => {
    const { item, service } = await seed();
    const created = await service.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'HEPA-фильтр',
      trackStock: false,
      intervalValue: 6,
      intervalUnit: 'month',
      dueMode: 'explicit',
      nextDueDate: '2026-12-01',
      remindersEnabled: false,
    });
    expect(created.consumable.stockQuantity).toBeNull();
    expect(created.consumable.nextDueDate).toBe('2026-12-01');
  });

  test('stock 0 vs null are distinct; reject negative', async () => {
    const { item, service } = await seed();
    const zero = await service.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'Мешки',
      trackStock: true,
      stockQuantity: 0,
      dueMode: 'none',
      remindersEnabled: false,
    });
    expect(zero.consumable.stockQuantity).toBe(0);

    const five = await service.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'Щётка',
      trackStock: true,
      stockQuantity: 5,
      dueMode: 'none',
      remindersEnabled: false,
    });
    expect(five.consumable.stockQuantity).toBe(5);

    await expect(
      service.setStock(five.consumable.id, -1),
    ).rejects.toThrow();
    await expect(service.setStock(five.consumable.id, 1.5)).rejects.toThrow();
    await expect(service.setStock(five.consumable.id, Number.NaN)).rejects.toThrow();
    await expect(service.setStock(five.consumable.id, Number.MAX_SAFE_INTEGER + 1)).rejects.toThrow();
  });

  test('editing other fields preserves null stock', async () => {
    const { item, service } = await seed();
    const created = await service.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'Filter',
      trackStock: false,
      remindersEnabled: false,
    });
    const updated = await service.update(created.consumable.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'Filter 2',
      trackStock: false,
      remindersEnabled: false,
    });
    expect(updated.consumable.stockQuantity).toBeNull();
  });

  test('stock only without schedule is valid', async () => {
    const { item, service } = await seed();
    const created = await service.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'Таблетки',
      trackStock: true,
      stockQuantity: 30,
      dueMode: 'none',
      remindersEnabled: false,
    });
    expect(created.consumable.stockQuantity).toBe(30);
    expect(created.consumable.nextDueDate).toBeNull();
  });

  test('mark replaced decrements stock and advances next due', async () => {
    const { item, service } = await seed();
    const created = await service.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'HEPA-фильтр',
      trackStock: true,
      stockQuantity: 3,
      intervalValue: 3,
      intervalUnit: 'month',
      dueMode: 'explicit',
      nextDueDate: '2026-09-01',
      remindersEnabled: false,
    });

    const done = await service.markReplaced(created.consumable.id, '2026-09-02');
    expect(done.consumable.stockQuantity).toBe(2);
    expect(done.consumable.nextDueDate).toBe('2026-12-02');
    expect(done.event.eventType).toBe('replacement');
    expect(done.event.stockBefore).toBe(3);
    expect(done.event.stockAfter).toBe(2);
  });

  test('zero stock replacement stays at 0 with confirm', async () => {
    const { item, service } = await seed();
    const created = await service.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'HEPA-фильтр',
      trackStock: true,
      stockQuantity: 0,
      intervalValue: 3,
      intervalUnit: 'month',
      dueMode: 'explicit',
      nextDueDate: '2026-09-01',
      remindersEnabled: false,
    });

    await expect(
      service.markReplaced(created.consumable.id, '2026-09-02'),
    ).rejects.toMatchObject({ code: 'STOCK_ZERO_CONFIRM' });

    const done = await service.markReplaced(
      created.consumable.id,
      '2026-09-02',
      null,
      { allowZeroStock: true },
    );
    expect(done.consumable.stockQuantity).toBe(0);
    expect(done.consumable.nextDueDate).toBe('2026-12-02');
  });

  test('add stock does not change next due', async () => {
    const { item, service } = await seed();
    const created = await service.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'HEPA-фильтр',
      trackStock: true,
      stockQuantity: 1,
      intervalValue: 3,
      intervalUnit: 'month',
      dueMode: 'explicit',
      nextDueDate: '2026-12-01',
      remindersEnabled: false,
    });

    const result = await service.addStock(created.consumable.id, 4);
    expect(result.consumable.stockQuantity).toBe(5);
    expect(result.consumable.nextDueDate).toBe('2026-12-01');
    expect(result.event.eventType).toBe('stock_add');
  });

  test('set stock does not change next due and records stock_set', async () => {
    const { item, service } = await seed();
    const created = await service.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'Filter', trackStock: true, stockQuantity: 3,
      intervalValue: 3, intervalUnit: 'month', dueMode: 'explicit',
      nextDueDate: '2026-12-01', remindersEnabled: false,
    });
    const result = await service.setStock(created.consumable.id, 10);
    expect(result.consumable.nextDueDate).toBe('2026-12-01');
    expect(result.event).toMatchObject({ eventType: 'stock_set', stockBefore: 3, stockAfter: 10, quantityDelta: 7 });
  });

  test('null-stock replacement keeps null and historical replacement does not move current state', async () => {
    const { item, service } = await seed();
    const created = await service.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'Filter', trackStock: false,
      intervalValue: 3, intervalUnit: 'month', dueMode: 'explicit',
      nextDueDate: '2026-09-10', remindersEnabled: false,
    });
    const latest = await service.markReplaced(created.consumable.id, '2026-09-10');
    expect(latest.consumable).toMatchObject({ stockQuantity: null, nextDueDate: '2026-12-10' });
    const historical = await service.markReplaced(created.consumable.id, '2026-08-01');
    expect(historical.consumable).toMatchObject({ stockQuantity: null, nextDueDate: '2026-12-10' });
    expect(service.listEvents(created.consumable.id)).toHaveLength(2);
  });

  test('database rejects contradictory typed event quantities', async () => {
    const { db, item, service } = await seed();
    const created = await service.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM, name: 'Filter', trackStock: true,
      stockQuantity: 2, remindersEnabled: false,
    });
    expect(() => db.run(`INSERT INTO consumable_events
      (id,item_id,consumable_id,event_type,replaced_at,quantity_delta,stock_before,stock_after,created_at,updated_at)
      VALUES ('bad',?,?,'stock_add',?,1,2,2,?,?)`,
    [item.id, created.consumable.id, '2026-01-01T12:00:00.000Z', '2026-01-01T12:00:00.000Z', '2026-01-01T12:00:00.000Z'])).toThrow();
  });

  test('item cascade removes consumables and events', async () => {
    const { db, item, service } = await seed();
    const created = await service.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'HEPA',
      trackStock: true,
      stockQuantity: 2,
      intervalValue: 3,
      intervalUnit: 'month',
      dueMode: 'explicit',
      nextDueDate: '2026-09-01',
      remindersEnabled: false,
    });
    await service.markReplaced(created.consumable.id, '2026-09-01');
    new ItemRepository(db).deleteItem(item.id);
    expect(db.getFirst('SELECT id FROM consumables LIMIT 1')).toBeNull();
    expect(db.getFirst('SELECT id FROM consumable_events LIMIT 1')).toBeNull();
  });
});
