/**
 * Warranty reminder scheduling tests via mock notification adapter.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
import { InventoryService } from '@/src/services/inventoryService';
import { MockNotificationAdapter } from '@/src/services/notificationAdapter';
import { WarrantyService } from '@/src/services/warrantyService';
import { ReminderRepository } from '@/src/repositories/reminderRepository';
import { EMPTY_ITEM_FORM } from '@/src/domain/inventory';
import { EMPTY_WARRANTY_FORM } from '@/src/domain/warranty';
import { addDaysToDateOnly, toLocalDateOnly } from '@/src/utils/datetime';

async function seedItem(db: SqlDatabase) {
  const inventory = new InventoryService(db);
  const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
  return inventory.createItem(propertyId, { ...EMPTY_ITEM_FORM, name: 'Robot vacuum' });
}

function endDateDaysFromNow(days: number): string {
  return addDaysToDateOnly(toLocalDateOnly(), days);
}

describe('warrantyReminders', () => {
  test('new warranty end in 60 days schedules 30 and 7 day offsets', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const item = await seedItem(db);
    const notifications = new MockNotificationAdapter();
    const service = new WarrantyService(db, notifications);

    await service.create(item.id, {
      ...EMPTY_WARRANTY_FORM,
      endDate: endDateDaysFromNow(60),
      durationMonths: null,
      reminderOffsets: [30, 7],
      remindersEnabled: true,
    });

    expect(notifications.scheduled).toHaveLength(2);
    const reminders = new ReminderRepository(db);
    const rows = reminders.listByWarrantyId(
      db.getFirst<{ id: string }>('SELECT id FROM warranties LIMIT 1')!.id,
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.notificationId != null)).toBe(true);
  });

  test('end in 10 days skips 30-day offset', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const item = await seedItem(db);
    const notifications = new MockNotificationAdapter();
    const service = new WarrantyService(db, notifications);

    await service.create(item.id, {
      ...EMPTY_WARRANTY_FORM,
      endDate: endDateDaysFromNow(10),
      durationMonths: null,
      reminderOffsets: [30, 7],
      remindersEnabled: true,
    });

    expect(notifications.scheduled).toHaveLength(1);
    expect(notifications.scheduled[0]!.body).toContain('7');
  });

  test('expired warranty schedules nothing', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const item = await seedItem(db);
    const notifications = new MockNotificationAdapter();
    const service = new WarrantyService(db, notifications);

    await service.create(item.id, {
      ...EMPTY_WARRANTY_FORM,
      endDate: endDateDaysFromNow(-5),
      durationMonths: null,
      reminderOffsets: [30, 7],
      remindersEnabled: true,
    });

    expect(notifications.scheduled).toHaveLength(0);
  });

  test('edit end date cancels old notifications and schedules new', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const item = await seedItem(db);
    const notifications = new MockNotificationAdapter();
    const service = new WarrantyService(db, notifications);

    const created = await service.create(item.id, {
      ...EMPTY_WARRANTY_FORM,
      endDate: endDateDaysFromNow(60),
      durationMonths: null,
      reminderOffsets: [30, 7],
      remindersEnabled: true,
    });

    const oldIds = notifications.scheduled.map((s) => s.id);
    notifications.reset();
    notifications.permissionGranted = true;

    await service.update(created.warranty.id, {
      ...EMPTY_WARRANTY_FORM,
      endDate: endDateDaysFromNow(45),
      durationMonths: null,
      reminderOffsets: [30, 7],
      remindersEnabled: true,
    });

    expect(notifications.cancelled).toEqual(expect.arrayContaining(oldIds));
    expect(notifications.scheduled.length).toBeGreaterThan(0);
  });

  test('delete warranty cancels scheduled notifications', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const item = await seedItem(db);
    const notifications = new MockNotificationAdapter();
    const service = new WarrantyService(db, notifications);

    const created = await service.create(item.id, {
      ...EMPTY_WARRANTY_FORM,
      endDate: endDateDaysFromNow(60),
      durationMonths: null,
      reminderOffsets: [30, 7],
      remindersEnabled: true,
    });

    const scheduledIds = [...notifications.scheduled.map((s) => s.id)];
    await service.delete(created.warranty.id);

    expect(notifications.cancelled).toEqual(expect.arrayContaining(scheduledIds));
    expect(
      db.getFirst('SELECT id FROM reminders WHERE warranty_id = ?', [created.warranty.id]),
    ).toBeNull();
  });

  test('permission denied saves warranty without notification rows', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const item = await seedItem(db);
    const notifications = new MockNotificationAdapter();
    notifications.permissionGranted = false;
    const service = new WarrantyService(db, notifications);

    const result = await service.create(item.id, {
      ...EMPTY_WARRANTY_FORM,
      endDate: endDateDaysFromNow(60),
      durationMonths: null,
      reminderOffsets: [30, 7],
      remindersEnabled: true,
    });

    expect(result.reminders.permissionDenied).toBe(true);
    expect(notifications.scheduled).toHaveLength(0);
    expect(db.getFirst('SELECT id FROM reminders LIMIT 1')).toBeNull();
  });

  test('duplicate offsets do not create duplicate notifications', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const item = await seedItem(db);
    const notifications = new MockNotificationAdapter();
    await new WarrantyService(db, notifications).create(item.id, {
      ...EMPTY_WARRANTY_FORM,
      startDate: null,
      endDate: endDateDaysFromNow(60),
      durationMonths: null,
      reminderOffsets: [30, 30, 7, 7],
      remindersEnabled: true,
    });
    expect(notifications.scheduled).toHaveLength(2);
  });

  test('partial scheduling failure keeps only real tracked notification ids', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const item = await seedItem(db);
    const notifications = new MockNotificationAdapter();
    const original = notifications.schedule.bind(notifications);
    let calls = 0;
    jest.spyOn(notifications, 'schedule').mockImplementation(async (input) => {
      calls += 1;
      if (calls === 2) throw new Error('OS failure');
      return original(input);
    });
    const result = await new WarrantyService(db, notifications).create(item.id, {
      ...EMPTY_WARRANTY_FORM,
      startDate: null,
      endDate: endDateDaysFromNow(60),
      durationMonths: null,
      reminderOffsets: [30, 7],
      remindersEnabled: true,
    });
    expect(result.reminders).toMatchObject({ scheduledCount: 1, failedCount: 1 });
    const rows = new ReminderRepository(db).listByWarrantyId(result.warranty.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.notificationId).toBe(notifications.scheduled[0]!.id);
  });

  test('cancel failure does not block warranty deletion', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const item = await seedItem(db);
    const notifications = new MockNotificationAdapter();
    const service = new WarrantyService(db, notifications);
    const created = await service.create(item.id, {
      ...EMPTY_WARRANTY_FORM,
      startDate: null,
      endDate: endDateDaysFromNow(60),
      durationMonths: null,
      reminderOffsets: [30],
      remindersEnabled: true,
    });
    jest.spyOn(notifications, 'cancel').mockRejectedValue(new Error('OS failure'));
    await expect(service.delete(created.warranty.id)).resolves.toBeUndefined();
    expect(service.getById(created.warranty.id)).toBeNull();
  });

  test('DB persistence failure cancels the newly scheduled OS notification', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const item = await seedItem(db);
    const notifications = new MockNotificationAdapter();
    jest.spyOn(ReminderRepository.prototype, 'create').mockImplementationOnce(() => {
      throw new Error('DB failure');
    });
    const result = await new WarrantyService(db, notifications).create(item.id, {
      ...EMPTY_WARRANTY_FORM,
      startDate: null,
      endDate: endDateDaysFromNow(60),
      durationMonths: null,
      reminderOffsets: [30],
      remindersEnabled: true,
    });
    expect(result.reminders).toMatchObject({ scheduledCount: 0, failedCount: 1 });
    expect(notifications.cancelled).toEqual([notifications.scheduled[0]!.id]);
    expect(db.getFirst('SELECT id FROM reminders LIMIT 1')).toBeNull();
  });
});
