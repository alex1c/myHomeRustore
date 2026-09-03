/**
 * Consumable reminder and Today attention tests.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import { EMPTY_ITEM_FORM } from '@/src/domain/inventory';
import { EMPTY_CONSUMABLE_FORM, CONSUMABLE_TODAY_AHEAD_DAYS } from '@/src/domain/consumables';
import { EMPTY_MAINTENANCE_FORM } from '@/src/domain/maintenance';
import { EMPTY_WARRANTY_FORM } from '@/src/domain/warranty';
import { InventoryService } from '@/src/services/inventoryService';
import { ConsumableService } from '@/src/services/consumableService';
import { MaintenanceService } from '@/src/services/maintenanceService';
import { WarrantyService } from '@/src/services/warrantyService';
import { ItemDeletionService } from '@/src/services/itemDeletionService';
import { MockNotificationAdapter } from '@/src/services/notificationAdapter';
import { ReminderRepository } from '@/src/repositories/reminderRepository';
import { addDaysToDateOnly, toLocalDateOnly } from '@/src/utils/datetime';
import { computeConsumableAttentionKind } from '@/src/utils/consumableDate';

function dueIn(days: number): string {
  return addDaysToDateOnly(toLocalDateOnly(), days);
}

describe('consumableReminders', () => {
  test('schedules default on-due-day reminder', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const inventory = new InventoryService(db);
    const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
    const item = inventory.createItem(propertyId, { ...EMPTY_ITEM_FORM, name: 'Robot' });
    const notifications = new MockNotificationAdapter();
    const service = new ConsumableService(db, notifications);

    await service.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'HEPA',
      intervalValue: 3,
      intervalUnit: 'month',
      dueMode: 'explicit',
      nextDueDate: dueIn(10),
      reminderOffsets: [0],
      remindersEnabled: true,
    });

    expect(notifications.scheduled).toHaveLength(1);
    expect(notifications.scheduled[0]!.title).toBe('Пора заменить расходник');
  });

  test('permission denied still saves consumable', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const inventory = new InventoryService(db);
    const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
    const item = inventory.createItem(propertyId, { ...EMPTY_ITEM_FORM, name: 'Robot' });
    const notifications = new MockNotificationAdapter();
    notifications.permissionGranted = false;
    const service = new ConsumableService(db, notifications);

    const result = await service.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'HEPA',
      dueMode: 'explicit',
      nextDueDate: dueIn(10),
      intervalValue: 3,
      intervalUnit: 'month',
      remindersEnabled: true,
    });

    expect(result.consumable.id).toBeTruthy();
    expect(result.reminders.permissionDenied).toBe(true);
    expect(db.getFirst('SELECT id FROM reminders LIMIT 1')).toBeNull();
  });

  test('rejects duplicate and unsupported reminder offsets', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const inventory = new InventoryService(db);
    const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
    const item = inventory.createItem(propertyId, { ...EMPTY_ITEM_FORM, name: 'Robot' });
    const service = new ConsumableService(db, new MockNotificationAdapter());
    for (const reminderOffsets of [[0, 0], [4], [Number.NaN], [Number.MAX_SAFE_INTEGER + 1]]) {
      await expect(service.create(item.id, {
        ...EMPTY_CONSUMABLE_FORM,
        name: 'HEPA',
        reminderOffsets,
        remindersEnabled: false,
      })).rejects.toThrow();
    }
  });

  test('mark replaced reschedules without duplicates', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const inventory = new InventoryService(db);
    const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
    const item = inventory.createItem(propertyId, { ...EMPTY_ITEM_FORM, name: 'Robot' });
    const notifications = new MockNotificationAdapter();
    const service = new ConsumableService(db, notifications);

    const created = await service.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'HEPA',
      trackStock: true,
      stockQuantity: 2,
      intervalValue: 30,
      intervalUnit: 'day',
      dueMode: 'explicit',
      nextDueDate: dueIn(5),
      reminderOffsets: [0],
      remindersEnabled: true,
    });

    const oldIds = notifications.scheduled.map((s) => s.id);
    await service.markReplaced(created.consumable.id, toLocalDateOnly());
    expect(notifications.cancelled).toEqual(expect.arrayContaining(oldIds));
    const rows = new ReminderRepository(db).listByConsumableId(created.consumable.id);
    expect(rows).toHaveLength(1);
  });

  test('delete consumable cancels notification', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const inventory = new InventoryService(db);
    const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
    const item = inventory.createItem(propertyId, { ...EMPTY_ITEM_FORM, name: 'Robot' });
    const notifications = new MockNotificationAdapter();
    const service = new ConsumableService(db, notifications);

    const created = await service.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'HEPA',
      dueMode: 'explicit',
      nextDueDate: dueIn(10),
      intervalValue: 3,
      intervalUnit: 'month',
      remindersEnabled: true,
    });
    const ids = notifications.scheduled.map((s) => s.id);
    await service.delete(created.consumable.id);
    expect(notifications.cancelled).toEqual(expect.arrayContaining(ids));
  });

  test('schedule failure after replacement keeps committed event, stock, and due date', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const inventory = new InventoryService(db);
    const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
    const item = inventory.createItem(propertyId, { ...EMPTY_ITEM_FORM, name: 'Robot' });
    const notifications = new MockNotificationAdapter();
    const service = new ConsumableService(db, notifications);
    const created = await service.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM, name: 'HEPA', trackStock: true, stockQuantity: 2,
      dueMode: 'explicit', nextDueDate: dueIn(2), intervalValue: 30,
      intervalUnit: 'day', remindersEnabled: false,
    });
    jest.spyOn(notifications, 'schedule').mockRejectedValueOnce(new Error('OS failure'));

    const done = await service.markReplaced(created.consumable.id, toLocalDateOnly());

    expect(done.reminders.failedCount).toBe(1);
    expect(done.consumable.stockQuantity).toBe(1);
    expect(done.consumable.nextDueDate).toBe(dueIn(30));
    expect(service.listEvents(created.consumable.id)).toHaveLength(1);
    expect(new ReminderRepository(db).listByConsumableId(created.consumable.id)).toHaveLength(0);
  });

  test('DB persistence failure cancels newly scheduled consumable notification', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const inventory = new InventoryService(db);
    const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
    const item = inventory.createItem(propertyId, { ...EMPTY_ITEM_FORM, name: 'Robot' });
    const notifications = new MockNotificationAdapter();
    const createSpy = jest.spyOn(ReminderRepository.prototype, 'create')
      .mockImplementationOnce(() => { throw new Error('DB failure'); });
    const service = new ConsumableService(db, notifications);

    const result = await service.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM, name: 'HEPA', dueMode: 'explicit',
      nextDueDate: dueIn(10), intervalValue: 3, intervalUnit: 'month',
      remindersEnabled: true,
    });

    createSpy.mockRestore();
    expect(result.reminders).toMatchObject({ scheduledCount: 0, failedCount: 1 });
    expect(notifications.cancelled).toContain('mock-notif-1');
    expect(new ReminderRepository(db).listByConsumableId(result.consumable.id)).toHaveLength(0);
  });

  test('cancel failure does not block consumable deletion', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const inventory = new InventoryService(db);
    const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
    const item = inventory.createItem(propertyId, { ...EMPTY_ITEM_FORM, name: 'Robot' });
    const notifications = new MockNotificationAdapter();
    const service = new ConsumableService(db, notifications);
    const created = await service.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM, name: 'HEPA', dueMode: 'explicit',
      nextDueDate: dueIn(10), intervalValue: 3, intervalUnit: 'month', remindersEnabled: true,
    });
    jest.spyOn(notifications, 'cancel').mockRejectedValue(new Error('OS failure'));

    await expect(service.delete(created.consumable.id)).resolves.toBeUndefined();
    expect(service.getById(created.consumable.id)).toBeNull();
  });

  test('item delete cancels warranty + maintenance + consumable notifications', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const inventory = new InventoryService(db);
    const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
    const item = inventory.createItem(propertyId, { ...EMPTY_ITEM_FORM, name: 'Robot' });
    const notifications = new MockNotificationAdapter();

    await new WarrantyService(db, notifications).create(item.id, {
      ...EMPTY_WARRANTY_FORM,
      endDate: dueIn(60),
      durationMonths: null,
      reminderOffsets: [30],
      remindersEnabled: true,
    });
    await new MaintenanceService(db, notifications).create(item.id, {
      ...EMPTY_MAINTENANCE_FORM,
      title: 'Clean',
      dueMode: 'explicit',
      nextDueDate: dueIn(10),
      reminderOffsets: [0],
      remindersEnabled: true,
    });
    await new ConsumableService(db, notifications).create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'HEPA',
      dueMode: 'explicit',
      nextDueDate: dueIn(10),
      intervalValue: 3,
      intervalUnit: 'month',
      remindersEnabled: true,
    });

    const scheduledIds = notifications.scheduled.map((s) => s.id);
    expect(scheduledIds.length).toBeGreaterThanOrEqual(3);

    await new ItemDeletionService(db, notifications).deleteItemWithFiles(item.id);
    expect(notifications.cancelled).toEqual(expect.arrayContaining(scheduledIds));
  });

  test('today attention includes stock0, overdue, +14; excludes +15; dedupes', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const inventory = new InventoryService(db);
    const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
    const item = inventory.createItem(propertyId, { ...EMPTY_ITEM_FORM, name: 'Robot' });
    const notifications = new MockNotificationAdapter();
    const service = new ConsumableService(db, notifications);

    await service.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'Out',
      trackStock: true,
      stockQuantity: 0,
      dueMode: 'explicit',
      nextDueDate: dueIn(-5),
      intervalValue: 30,
      intervalUnit: 'day',
      remindersEnabled: false,
    });
    await service.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'In14',
      dueMode: 'explicit',
      nextDueDate: dueIn(CONSUMABLE_TODAY_AHEAD_DAYS),
      intervalValue: 30,
      intervalUnit: 'day',
      remindersEnabled: false,
    });
    await service.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'In15',
      dueMode: 'explicit',
      nextDueDate: dueIn(CONSUMABLE_TODAY_AHEAD_DAYS + 1),
      intervalValue: 30,
      intervalUnit: 'day',
      remindersEnabled: false,
    });
    await service.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'OkFuture',
      dueMode: 'explicit',
      nextDueDate: dueIn(40),
      intervalValue: 30,
      intervalUnit: 'day',
      remindersEnabled: false,
    });

    const attention = service.listAttentionForProperty(
      propertyId,
      CONSUMABLE_TODAY_AHEAD_DAYS,
    );
    const names = attention.map((r) => r.consumable.name);
    expect(names).toContain('Out');
    expect(names).toContain('In14');
    expect(names).not.toContain('In15');
    expect(names).not.toContain('OkFuture');
    expect(names.filter((n) => n === 'Out')).toHaveLength(1);

    expect(
      computeConsumableAttentionKind({
        stockQuantity: 0,
        nextDueDate: dueIn(-5),
      }),
    ).toBe('out_of_stock');
  });
});
