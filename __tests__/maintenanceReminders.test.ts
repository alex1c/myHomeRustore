/**
 * Maintenance reminder scheduling tests via mock notification adapter.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import { EMPTY_ITEM_FORM } from '@/src/domain/inventory';
import { EMPTY_MAINTENANCE_FORM, MAINTENANCE_TODAY_AHEAD_DAYS } from '@/src/domain/maintenance';
import { EMPTY_WARRANTY_FORM } from '@/src/domain/warranty';
import { InventoryService } from '@/src/services/inventoryService';
import { ItemDeletionService } from '@/src/services/itemDeletionService';
import { MaintenanceService } from '@/src/services/maintenanceService';
import { MockNotificationAdapter } from '@/src/services/notificationAdapter';
import { WarrantyService } from '@/src/services/warrantyService';
import { ReminderRepository } from '@/src/repositories/reminderRepository';
import { addDaysToDateOnly, toLocalDateOnly } from '@/src/utils/datetime';

function dueIn(days: number): string {
  return addDaysToDateOnly(toLocalDateOnly(), days);
}

describe('maintenanceReminders', () => {
  test('create schedules default on-due-day reminder', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const inventory = new InventoryService(db);
    const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
    const item = inventory.createItem(propertyId, { ...EMPTY_ITEM_FORM, name: 'AC' });
    const notifications = new MockNotificationAdapter();
    const service = new MaintenanceService(db, notifications);

    await service.create(item.id, {
      ...EMPTY_MAINTENANCE_FORM,
      title: 'Очистить фильтр',
      dueMode: 'explicit',
      nextDueDate: dueIn(10),
      reminderOffsets: [0],
      remindersEnabled: true,
    });

    expect(notifications.scheduled).toHaveLength(1);
    expect(notifications.scheduled[0]!.title).toBe('Пора выполнить обслуживание');
  });

  test('past due does not schedule on-day offset', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const inventory = new InventoryService(db);
    const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
    const item = inventory.createItem(propertyId, { ...EMPTY_ITEM_FORM, name: 'AC' });
    const notifications = new MockNotificationAdapter();
    const service = new MaintenanceService(db, notifications);

    await service.create(item.id, {
      ...EMPTY_MAINTENANCE_FORM,
      title: 'Очистить фильтр',
      dueMode: 'explicit',
      nextDueDate: dueIn(-2),
      reminderOffsets: [0, 1, 3],
      remindersEnabled: true,
    });

    expect(notifications.scheduled).toHaveLength(0);
  });

  test('mark done cancels old and schedules next without duplicates', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const inventory = new InventoryService(db);
    const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
    const item = inventory.createItem(propertyId, { ...EMPTY_ITEM_FORM, name: 'AC' });
    const notifications = new MockNotificationAdapter();
    const service = new MaintenanceService(db, notifications);

    const created = await service.create(item.id, {
      ...EMPTY_MAINTENANCE_FORM,
      title: 'Очистить фильтр',
      intervalValue: 30,
      intervalUnit: 'day',
      dueMode: 'explicit',
      nextDueDate: dueIn(5),
      reminderOffsets: [0],
      remindersEnabled: true,
    });

    const oldIds = notifications.scheduled.map((s) => s.id);
    await service.markDone(created.rule.id, toLocalDateOnly());

    expect(notifications.cancelled).toEqual(expect.arrayContaining(oldIds));
    const rows = new ReminderRepository(db).listByMaintenanceRuleId(created.rule.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.notificationId).toBeTruthy();
  });

  test('permission denied still saves rule', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const inventory = new InventoryService(db);
    const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
    const item = inventory.createItem(propertyId, { ...EMPTY_ITEM_FORM, name: 'AC' });
    const notifications = new MockNotificationAdapter();
    notifications.permissionGranted = false;
    const service = new MaintenanceService(db, notifications);

    const result = await service.create(item.id, {
      ...EMPTY_MAINTENANCE_FORM,
      title: 'Очистить фильтр',
      dueMode: 'explicit',
      nextDueDate: dueIn(10),
      reminderOffsets: [0],
      remindersEnabled: true,
    });

    expect(result.rule.id).toBeTruthy();
    expect(result.reminders.permissionDenied).toBe(true);
    expect(db.getFirst('SELECT id FROM reminders LIMIT 1')).toBeNull();
  });

  test('schedule failure after mark done keeps event', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const inventory = new InventoryService(db);
    const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
    const item = inventory.createItem(propertyId, { ...EMPTY_ITEM_FORM, name: 'AC' });
    const notifications = new MockNotificationAdapter();
    const service = new MaintenanceService(db, notifications);

    const created = await service.create(item.id, {
      ...EMPTY_MAINTENANCE_FORM,
      title: 'Очистить фильтр',
      intervalValue: 30,
      intervalUnit: 'day',
      dueMode: 'explicit',
      nextDueDate: dueIn(5),
      reminderOffsets: [0],
      remindersEnabled: true,
    });

    notifications.schedule = async () => {
      throw new Error('os fail');
    };

    const done = await service.markDone(created.rule.id, toLocalDateOnly());
    expect(done.event.id).toBeTruthy();
    expect(done.reminders.failedCount).toBeGreaterThan(0);
  });

  test('delete rule cancels OS notification', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const inventory = new InventoryService(db);
    const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
    const item = inventory.createItem(propertyId, { ...EMPTY_ITEM_FORM, name: 'AC' });
    const notifications = new MockNotificationAdapter();
    const service = new MaintenanceService(db, notifications);

    const created = await service.create(item.id, {
      ...EMPTY_MAINTENANCE_FORM,
      title: 'Очистить фильтр',
      dueMode: 'explicit',
      nextDueDate: dueIn(10),
      reminderOffsets: [0],
      remindersEnabled: true,
    });
    const ids = notifications.scheduled.map((s) => s.id);
    await service.deleteRule(created.rule.id);
    expect(notifications.cancelled).toEqual(expect.arrayContaining(ids));
  });

  test('delete item cancels maintenance and warranty notifications', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const inventory = new InventoryService(db);
    const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
    const item = inventory.createItem(propertyId, { ...EMPTY_ITEM_FORM, name: 'AC' });
    const notifications = new MockNotificationAdapter();
    const maintenance = new MaintenanceService(db, notifications);
    const warranties = new WarrantyService(db, notifications);

    await maintenance.create(item.id, {
      ...EMPTY_MAINTENANCE_FORM,
      title: 'Очистить фильтр',
      dueMode: 'explicit',
      nextDueDate: dueIn(10),
      reminderOffsets: [0],
      remindersEnabled: true,
    });
    await warranties.create(item.id, {
      ...EMPTY_WARRANTY_FORM,
      endDate: dueIn(60),
      durationMonths: null,
      reminderOffsets: [30, 7],
      remindersEnabled: true,
    });

    const scheduledIds = notifications.scheduled.map((s) => s.id);
    expect(scheduledIds.length).toBeGreaterThan(1);

    await new ItemDeletionService(db, notifications).deleteItemWithFiles(item.id);
    expect(notifications.cancelled).toEqual(expect.arrayContaining(scheduledIds));
  });

  test('today attention includes +14 and excludes +15; overdue remains', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const inventory = new InventoryService(db);
    const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
    const item = inventory.createItem(propertyId, { ...EMPTY_ITEM_FORM, name: 'AC' });
    const notifications = new MockNotificationAdapter();
    const service = new MaintenanceService(db, notifications);

    await service.create(item.id, {
      ...EMPTY_MAINTENANCE_FORM,
      title: 'Overdue',
      dueMode: 'explicit',
      nextDueDate: dueIn(-3),
      remindersEnabled: false,
    });
    await service.create(item.id, {
      ...EMPTY_MAINTENANCE_FORM,
      title: 'In14',
      dueMode: 'explicit',
      nextDueDate: dueIn(MAINTENANCE_TODAY_AHEAD_DAYS),
      remindersEnabled: false,
    });
    await service.create(item.id, {
      ...EMPTY_MAINTENANCE_FORM,
      title: 'In15',
      dueMode: 'explicit',
      nextDueDate: dueIn(MAINTENANCE_TODAY_AHEAD_DAYS + 1),
      remindersEnabled: false,
    });

    const attention = service.listAttentionForProperty(
      propertyId,
      MAINTENANCE_TODAY_AHEAD_DAYS,
    );
    const titles = attention.map((r) => r.rule.title);
    expect(titles).toContain('Overdue');
    expect(titles).toContain('In14');
    expect(titles).not.toContain('In15');
  });
});
