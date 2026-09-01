/**
 * Cross-entity integrity and cascade tests.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
import { ItemRepository } from '@/src/repositories/itemRepository';
import { LocationRepository } from '@/src/repositories/locationRepository';
import { MaintenanceRepository } from '@/src/repositories/maintenanceRepository';
import { PropertyRepository } from '@/src/repositories/propertyRepository';

const NOW = '2024-06-01T10:00:00.000Z';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  return createDatabaseFromClient(createSqlJsAdapter(raw));
}

describe('integrity', () => {
  test('item cannot use location from another property', async () => {
    const db = await openTestDb();
    const properties = new PropertyRepository(db);
    const locations = new LocationRepository(db);
    const items = new ItemRepository(db);

    const homeA = properties.createProperty({ name: 'A' });
    const homeB = properties.createProperty({ name: 'B' });
    const kitchenB = locations.createLocation({
      propertyId: homeB.id,
      name: 'Kitchen B',
    });

    expect(() =>
      items.createItem({
        propertyId: homeA.id,
        name: 'Fridge',
        locationId: kitchenB.id,
      }),
    ).toThrow();
  });

  test('maintenance event cannot reference rule of another item', async () => {
    const db = await openTestDb();
    const properties = new PropertyRepository(db);
    const items = new ItemRepository(db);
    const maintenance = new MaintenanceRepository(db);

    const home = properties.listProperties()[0]!;
    const washer = items.createItem({ propertyId: home.id, name: 'Washer' });
    const dryer = items.createItem({ propertyId: home.id, name: 'Dryer' });
    const rule = maintenance.createRule({
      itemId: washer.id,
      title: 'Clean filter',
    });

    expect(() =>
      maintenance.createEvent({
        itemId: dryer.id,
        maintenanceRuleId: rule.id,
        performedAt: NOW,
      }),
    ).toThrow();
  });

  test('deleting item cascades warranties and maintenance metadata', async () => {
    const db = await openTestDb();
    const properties = new PropertyRepository(db);
    const items = new ItemRepository(db);

    const home = properties.listProperties()[0]!;
    const item = items.createItem({ propertyId: home.id, name: 'TV' });

    db.run(
      `INSERT INTO warranties
       (id, item_id, type, provider, start_date, end_date, duration_months, note, created_at, updated_at)
       VALUES (?, ?, 'manufacturer', 'Shop', NULL, NULL, NULL, NULL, ?, ?)`,
      ['w-1', item.id, NOW, NOW],
    );

    db.run(
      `INSERT INTO maintenance_rules
       (id, item_id, title, interval_value, interval_unit, last_completed_date,
        next_due_date, enabled, note, created_at, updated_at)
       VALUES (?, ?, 'Dust', 3, 'month', NULL, NULL, 1, NULL, ?, ?)`,
      ['mr-1', item.id, NOW, NOW],
    );

    items.deleteItem(item.id);

    expect(
      db.getFirst('SELECT id FROM warranties WHERE item_id = ?', [item.id]),
    ).toBeNull();
    expect(
      db.getFirst('SELECT id FROM maintenance_rules WHERE item_id = ?', [item.id]),
    ).toBeNull();
  });

  test('deleting an item cascades all direct and indirect metadata', async () => {
    const db = await openTestDb();
    const home = new PropertyRepository(db).listProperties()[0]!;
    const item = new ItemRepository(db).createItem({ propertyId: home.id, name: 'Boiler' });

    db.run(`INSERT INTO purchases (id,item_id,currency,created_at,updated_at) VALUES ('p',?,'RUB',?,?)`, [item.id, NOW, NOW]);
    db.run(`INSERT INTO warranties (id,item_id,type,created_at,updated_at) VALUES ('w',?,'manufacturer',?,?)`, [item.id, NOW, NOW]);
    db.run(`INSERT INTO documents (id,item_id,type,title,file_path,created_at,updated_at) VALUES ('d',?,'manual','Manual','documents/d.pdf',?,?)`, [item.id, NOW, NOW]);
    db.run(`INSERT INTO maintenance_rules (id,item_id,title,created_at,updated_at) VALUES ('mr',?,'Service',?,?)`, [item.id, NOW, NOW]);
    db.run(`INSERT INTO maintenance_events (id,item_id,maintenance_rule_id,performed_at,created_at,updated_at) VALUES ('me',?,'mr',?,?,?)`, [item.id, NOW, NOW, NOW]);
    db.run(`INSERT INTO consumables (id,item_id,name,created_at,updated_at) VALUES ('c',?,'Filter',?,?)`, [item.id, NOW, NOW]);
    db.run(`INSERT INTO consumable_events (id,item_id,consumable_id,replaced_at,created_at,updated_at) VALUES ('ce',?,'c',?,?,?)`, [item.id, NOW, NOW, NOW]);
    db.run(`INSERT INTO reminders (id,item_id,reminder_type,warranty_id,due_at,created_at,updated_at) VALUES ('r',?,'warranty','w',?,?,?)`, [item.id, NOW, NOW, NOW]);

    new ItemRepository(db).deleteItem(item.id);

    for (const table of ['purchases', 'warranties', 'documents', 'maintenance_rules', 'maintenance_events', 'consumables', 'consumable_events', 'reminders']) {
      expect(db.getFirst(`SELECT id FROM ${table} LIMIT 1`)).toBeNull();
    }
  });

  test('deleting a maintenance rule keeps its event and clears only rule id', async () => {
    const db = await openTestDb();
    const home = new PropertyRepository(db).listProperties()[0]!;
    const item = new ItemRepository(db).createItem({ propertyId: home.id, name: 'Boiler' });
    const maintenance = new MaintenanceRepository(db);
    const rule = maintenance.createRule({ itemId: item.id, title: 'Service' });
    const event = maintenance.createEvent({ itemId: item.id, maintenanceRuleId: rule.id, performedAt: NOW });

    db.run('DELETE FROM maintenance_rules WHERE id = ?', [rule.id]);

    expect(maintenance.getEventById(event.id)?.itemId).toBe(item.id);
    expect(maintenance.getEventById(event.id)?.maintenanceRuleId).toBeNull();
  });

  test('consumable event must belong to same item as consumable', async () => {
    const db = await openTestDb();
    const properties = new PropertyRepository(db);
    const items = new ItemRepository(db);

    const home = properties.listProperties()[0]!;
    const vacuum = items.createItem({ propertyId: home.id, name: 'Vacuum' });
    const humidifier = items.createItem({ propertyId: home.id, name: 'Humidifier' });

    db.run(
      `INSERT INTO consumables
       (id, item_id, name, model_or_article, replacement_interval_value,
        replacement_interval_unit, last_replaced_date, next_due_date, price_minor,
        note, active, created_at, updated_at)
       VALUES (?, ?, 'HEPA', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, ?, ?)`,
      ['c-1', vacuum.id, NOW, NOW],
    );

    expect(() =>
      db.run(
        `INSERT INTO consumable_events
         (id, item_id, consumable_id, replaced_at, cost_minor, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)`,
        ['ce-1', humidifier.id, 'c-1', NOW, NOW, NOW],
      ),
    ).toThrow();
  });

  test.each([
    ['warranty', 'warranty_id', 'w'],
    ['maintenance', 'maintenance_rule_id', 'mr'],
    ['consumable', 'consumable_id', 'c'],
  ])('reminder %s target cannot belong to another item', async (type, column, targetId) => {
    const db = await openTestDb();
    const home = new PropertyRepository(db).listProperties()[0]!;
    const items = new ItemRepository(db);
    const itemA = items.createItem({ propertyId: home.id, name: 'A' });
    const itemB = items.createItem({ propertyId: home.id, name: 'B' });
    db.run(`INSERT INTO warranties (id,item_id,type,created_at,updated_at) VALUES ('w',?,'manufacturer',?,?)`, [itemB.id, NOW, NOW]);
    db.run(`INSERT INTO maintenance_rules (id,item_id,title,created_at,updated_at) VALUES ('mr',?,'Rule',?,?)`, [itemB.id, NOW, NOW]);
    db.run(`INSERT INTO consumables (id,item_id,name,created_at,updated_at) VALUES ('c',?,'Filter',?,?)`, [itemB.id, NOW, NOW]);

    expect(() => db.run(
      `INSERT INTO reminders (id,item_id,reminder_type,${column},due_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`,
      [`r-${type}`, itemA.id, type, targetId, NOW, NOW, NOW],
    )).toThrow();
  });

  test('reminder type requires exactly its matching target', async () => {
    const db = await openTestDb();
    const home = new PropertyRepository(db).listProperties()[0]!;
    const item = new ItemRepository(db).createItem({ propertyId: home.id, name: 'A' });
    db.run(`INSERT INTO warranties (id,item_id,type,created_at,updated_at) VALUES ('w',?,'manufacturer',?,?)`, [item.id, NOW, NOW]);
    db.run(`INSERT INTO maintenance_rules (id,item_id,title,created_at,updated_at) VALUES ('mr',?,'Rule',?,?)`, [item.id, NOW, NOW]);

    expect(() => db.run(
      `INSERT INTO reminders (id,item_id,reminder_type,due_at,created_at,updated_at) VALUES ('missing',?,'warranty',?,?,?)`,
      [item.id, NOW, NOW, NOW],
    )).toThrow();
    expect(() => db.run(
      `INSERT INTO reminders (id,item_id,reminder_type,warranty_id,maintenance_rule_id,due_at,created_at,updated_at) VALUES ('multiple',?,'warranty','w','mr',?,?,?)`,
      [item.id, NOW, NOW, NOW],
    )).toThrow();
  });

  test('database rejects unsafe and duplicate managed paths', async () => {
    const db = await openTestDb();
    const home = new PropertyRepository(db).listProperties()[0]!;
    const items = new ItemRepository(db);
    const itemA = items.createItem({ propertyId: home.id, name: 'A', primaryPhotoPath: 'photos/a.jpg' });
    expect(() => items.createItem({ propertyId: home.id, name: 'B', primaryPhotoPath: 'photos/a.jpg' })).toThrow();
    expect(() => items.createItem({ propertyId: home.id, name: 'C', primaryPhotoPath: 'photos/../x' })).toThrow();
    expect(() => db.run(
      `INSERT INTO documents (id,item_id,type,title,file_path,created_at,updated_at) VALUES ('bad',?,'manual','Bad','file:///tmp/a',?,?)`,
      [itemA.id, NOW, NOW],
    )).toThrow();
  });
});
