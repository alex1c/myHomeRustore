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
});
