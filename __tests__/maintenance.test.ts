/**
 * Maintenance rules CRUD, mark-done, history recompute tests.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
import { EMPTY_ITEM_FORM } from '@/src/domain/inventory';
import { EMPTY_MAINTENANCE_FORM } from '@/src/domain/maintenance';
import { InventoryService } from '@/src/services/inventoryService';
import { MaintenanceService } from '@/src/services/maintenanceService';
import { MockNotificationAdapter } from '@/src/services/notificationAdapter';
import { ItemRepository } from '@/src/repositories/itemRepository';
import { utcInstantToDateOnly } from '@/src/utils/datetime';

async function seed(db: SqlDatabase) {
  const inventory = new InventoryService(db);
  const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
  const item = inventory.createItem(propertyId, {
    ...EMPTY_ITEM_FORM,
    name: 'Кондиционер',
    category: 'Климат',
  });
  const notifications = new MockNotificationAdapter();
  const service = new MaintenanceService(db, notifications);
  return { item, service, notifications, propertyId };
}

describe('maintenance rules', () => {
  test('create update delete and multiple rules per item', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const { item, service } = await seed(db);

    const a = await service.create(item.id, {
      ...EMPTY_MAINTENANCE_FORM,
      title: 'Очистить фильтр',
      intervalValue: 30,
      intervalUnit: 'day',
      dueMode: 'explicit',
      nextDueDate: '2026-09-15',
      remindersEnabled: false,
    });
    const b = await service.create(item.id, {
      ...EMPTY_MAINTENANCE_FORM,
      title: 'Профессиональное обслуживание',
      intervalValue: 12,
      intervalUnit: 'month',
      dueMode: 'explicit',
      nextDueDate: '2027-01-01',
      remindersEnabled: false,
    });

    expect(service.listByItem(item.id)).toHaveLength(2);

    await service.update(a.rule.id, {
      ...EMPTY_MAINTENANCE_FORM,
      title: 'Очистить фильтр аккуратно',
      intervalValue: 30,
      intervalUnit: 'day',
      dueMode: 'explicit',
      nextDueDate: '2026-09-20',
      remindersEnabled: false,
    });
    expect(service.getRuleById(a.rule.id)?.title).toBe('Очистить фильтр аккуратно');

    await service.deleteRule(b.rule.id);
    expect(service.listByItem(item.id)).toHaveLength(1);
  });

  test('mark done creates event and next due from actual date', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const { item, service } = await seed(db);

    const created = await service.create(item.id, {
      ...EMPTY_MAINTENANCE_FORM,
      title: 'Очистить фильтр',
      intervalValue: 30,
      intervalUnit: 'day',
      dueMode: 'explicit',
      nextDueDate: '2026-09-01',
      remindersEnabled: false,
    });

    const done = await service.markDone(created.rule.id, '2026-09-05');
    expect(utcInstantToDateOnly(done.event.performedAt)).toBe('2026-09-05');
    expect(done.rule.lastCompletedDate).toBe('2026-09-05');
    expect(done.rule.nextDueDate).toBe('2026-10-05');

    const again = await service.markDone(created.rule.id, '2026-10-05');
    expect(service.listEventsForRule(created.rule.id)).toHaveLength(2);
    expect(again.rule.nextDueDate).toBe('2026-11-04');
  });

  test('editing latest event recomputes next due', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const { item, service } = await seed(db);

    const created = await service.create(item.id, {
      ...EMPTY_MAINTENANCE_FORM,
      title: 'Service',
      intervalValue: 1,
      intervalUnit: 'month',
      dueMode: 'explicit',
      nextDueDate: '2026-07-01',
      remindersEnabled: false,
    });

    await service.markDone(created.rule.id, '2026-07-01');
    await service.markDone(created.rule.id, '2026-08-01');
    const third = await service.markDone(created.rule.id, '2026-09-01');
    expect(third.rule.nextDueDate).toBe('2026-10-01');

    const latest = service.listEventsForRule(created.rule.id)[0]!;
    const updated = await service.updateEvent(latest.id, {
      performedDate: '2026-09-05',
    });
    expect(updated.rule?.nextDueDate).toBe('2026-10-05');
  });

  test('deleting latest event recomputes from previous', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const { item, service } = await seed(db);

    const created = await service.create(item.id, {
      ...EMPTY_MAINTENANCE_FORM,
      title: 'Service',
      intervalValue: 1,
      intervalUnit: 'month',
      dueMode: 'explicit',
      nextDueDate: '2026-07-01',
      remindersEnabled: false,
    });

    await service.markDone(created.rule.id, '2026-07-01');
    await service.markDone(created.rule.id, '2026-08-01');
    await service.markDone(created.rule.id, '2026-09-05');

    const latest = service.listEventsForRule(created.rule.id)[0]!;
    const result = await service.deleteEvent(latest.id);
    expect(result.rule?.lastCompletedDate).toBe('2026-08-01');
    expect(result.rule?.nextDueDate).toBe('2026-09-01');
  });

  test('item cascade removes rules and events', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const { item, service } = await seed(db);

    const created = await service.create(item.id, {
      ...EMPTY_MAINTENANCE_FORM,
      title: 'Service',
      intervalValue: 30,
      intervalUnit: 'day',
      dueMode: 'explicit',
      nextDueDate: '2026-09-01',
      remindersEnabled: false,
    });
    await service.markDone(created.rule.id, '2026-09-01');

    new ItemRepository(db).deleteItem(item.id);
    expect(db.getFirst('SELECT id FROM maintenance_rules LIMIT 1')).toBeNull();
    expect(db.getFirst('SELECT id FROM maintenance_events LIMIT 1')).toBeNull();
  });
});
