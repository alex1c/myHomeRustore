/**
 * Migration runner tests using sql.js in-memory SQLite.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { getExpectedSchemaVersion, runMigrations } from '@/src/db/migrate';
import { CURRENT_SCHEMA_VERSION } from '@/src/db/migrations';
import { migration001Initial } from '@/src/db/migrations/001_initial';
import { migration002WarrantyIntegrity } from '@/src/db/migrations/002_warranty_integrity';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  const adapter = createSqlJsAdapter(raw);
  return createDatabaseFromClient(adapter);
}

describe('migrations', () => {
  test('fresh DB reaches current schema version', async () => {
    const db = await openTestDb();
    expect(db.getUserVersion()).toBe(CURRENT_SCHEMA_VERSION);
    expect(getExpectedSchemaVersion()).toBe(3);
  });

  test('core tables exist after migration', async () => {
    const db = await openTestDb();
    const tables = db.getAll<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
    );
    const names = tables.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'properties',
        'locations',
        'items',
        'purchases',
        'warranties',
        'documents',
        'maintenance_rules',
        'maintenance_events',
        'consumables',
        'consumable_events',
        'reminders',
        'app_settings',
        'schema_migrations',
      ]),
    );
  });

  test('repeated migration is idempotent', async () => {
    const SQL = await initSqlJs();
    const raw = new SQL.Database();
    const adapter = createSqlJsAdapter(raw);
    createDatabaseFromClient(adapter);
    const versionBefore = adapter.getUserVersion();
    runMigrations(adapter);
    expect(adapter.getUserVersion()).toBe(versionBefore);
  });

  test('v2 fixture upgrades to v3 without changing existing consumables or events', async () => {
    const SQL = await initSqlJs();
    const adapter = createSqlJsAdapter(new SQL.Database());
    adapter.exec('PRAGMA foreign_keys = ON;');
    migration001Initial.up(adapter);
    adapter.setUserVersion(1);
    adapter.run("INSERT INTO schema_migrations VALUES (1, '001_initial', '2026-01-01T00:00:00.000Z')");
    migration002WarrantyIntegrity.up(adapter);
    adapter.setUserVersion(2);
    adapter.run("INSERT INTO schema_migrations VALUES (2, '002_warranty_integrity', '2026-01-01T00:00:00.000Z')");

    const propertyId = 'property-v2';
    adapter.run(`INSERT INTO properties (id, name, type, created_at, updated_at)
      VALUES (?, 'Home', 'home', ?, ?)`,
    [propertyId, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z']);
    adapter.run(`INSERT INTO items
      (id, property_id, category, name, status, created_at, updated_at)
      VALUES ('item-v2', ?, 'other', 'Vacuum', 'active', ?, ?)`,
    [propertyId, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z']);
    adapter.run(`INSERT INTO consumables
      (id, item_id, name, last_replaced_date, next_due_date, active, created_at, updated_at)
      VALUES ('cons-v2', 'item-v2', 'Filter', '2026-01-31', '2026-02-28', 1, ?, ?)`,
    ['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z']);
    adapter.run(`INSERT INTO consumable_events
      (id, item_id, consumable_id, replaced_at, note, created_at, updated_at)
      VALUES ('event-v2', 'item-v2', 'cons-v2', ?, 'old event', ?, ?)`,
    ['2026-01-31T12:00:00.000Z', '2026-01-31T12:00:00.000Z', '2026-01-31T12:00:00.000Z']);
    adapter.run(`INSERT INTO reminders
      (id, item_id, reminder_type, consumable_id, due_at, notification_id, enabled, created_at, updated_at)
      VALUES ('rem-v2', 'item-v2', 'consumable', 'cons-v2', ?, 'os-v2', 1, ?, ?)`,
    ['2026-02-28T09:00:00.000Z', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z']);

    runMigrations(adapter);

    expect(adapter.getUserVersion()).toBe(3);
    expect(adapter.getFirst<{ stock_quantity: number | null; next_due_date: string }>(
      "SELECT stock_quantity, next_due_date FROM consumables WHERE id = 'cons-v2'",
    )).toEqual({ stock_quantity: null, next_due_date: '2026-02-28' });
    expect(adapter.getFirst<{ event_type: string; note: string }>(
      "SELECT event_type, note FROM consumable_events WHERE id = 'event-v2'",
    )).toEqual({ event_type: 'replacement', note: 'old event' });
    expect(adapter.getFirst<{ notification_id: string }>(
      "SELECT notification_id FROM reminders WHERE id = 'rem-v2'",
    )?.notification_id).toBe('os-v2');
  });

  test('migration 003 and user_version roll back together on failure', async () => {
    const SQL = await initSqlJs();
    const adapter = createSqlJsAdapter(new SQL.Database());
    migration001Initial.up(adapter);
    adapter.setUserVersion(1);
    adapter.run("INSERT INTO schema_migrations VALUES (1, '001_initial', '2026-01-01T00:00:00.000Z')");
    migration002WarrantyIntegrity.up(adapter);
    adapter.setUserVersion(2);
    adapter.run("INSERT INTO schema_migrations VALUES (2, '002_warranty_integrity', '2026-01-01T00:00:00.000Z')");
    const failingDb: SqlDatabase = {
      ...adapter,
      run(sql, params) {
        if (sql.includes('INSERT INTO schema_migrations')) throw new Error('phase 5 failure');
        return adapter.run(sql, params);
      },
    };

    expect(() => runMigrations(failingDb)).toThrow('Migration 3');
    expect(adapter.getUserVersion()).toBe(2);
    expect(adapter.getAll<{ name: string }>("PRAGMA table_info('consumables')")
      .some((column) => column.name === 'stock_quantity')).toBe(false);
  });

  test('migration and version roll back together on failure', async () => {
    const SQL = await initSqlJs();
    const raw = new SQL.Database();
    const adapter = createSqlJsAdapter(raw);
    const failingDb: SqlDatabase = {
      ...adapter,
      run(sql, params) {
        if (sql.includes('INSERT INTO schema_migrations')) {
          throw new Error('artificial migration failure');
        }
        return adapter.run(sql, params);
      },
    };

    expect(() => runMigrations(failingDb)).toThrow('Migration 1');
    expect(adapter.getUserVersion()).toBe(0);
    expect(
      adapter.getFirst(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'properties'",
      ),
    ).toBeNull();
  });

  test('rejects newer database before attempting migrations', async () => {
    const SQL = await initSqlJs();
    const adapter = createSqlJsAdapter(new SQL.Database());
    adapter.setUserVersion(CURRENT_SCHEMA_VERSION + 1);
    expect(() => runMigrations(adapter)).toThrow('is newer than app');
  });

  test('rejects user_version that disagrees with migration history', async () => {
    const SQL = await initSqlJs();
    const adapter = createSqlJsAdapter(new SQL.Database());
    adapter.exec('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT)');
    adapter.run("INSERT INTO schema_migrations VALUES (1, 'wrong', '2026-01-01T00:00:00.000Z')");
    adapter.run("INSERT INTO schema_migrations VALUES (2, '002_warranty_integrity', '2026-01-01T00:00:00.000Z')");
    adapter.run("INSERT INTO schema_migrations VALUES (3, '003_consumable_stock', '2026-01-01T00:00:00.000Z')");
    adapter.setUserVersion(CURRENT_SCHEMA_VERSION);
    expect(() => runMigrations(adapter)).toThrow('Migration history mismatch');
  });

  test('default property is created on first open', async () => {
    const db = await openTestDb();
    const row = db.getFirst<{ c: number }>(
      'SELECT COUNT(*) AS c FROM properties',
    );
    expect(row?.c).toBe(1);
    const property = db.getFirst<{ name: string }>(
      'SELECT name FROM properties LIMIT 1',
    );
    expect(property?.name).toBe('Мой дом');
  });

  test('default property seed stays idempotent across repeated clients', async () => {
    const SQL = await initSqlJs();
    const adapter = createSqlJsAdapter(new SQL.Database());
    createDatabaseFromClient(adapter);
    createDatabaseFromClient(adapter);
    createDatabaseFromClient(adapter);
    expect(
      adapter.getFirst<{ c: number }>('SELECT COUNT(*) AS c FROM properties')?.c,
    ).toBe(1);
  });

  test('foreign keys are enforced', async () => {
    const SQL = await initSqlJs();
    const raw = new SQL.Database();
    const adapter = createSqlJsAdapter(raw);
    adapter.exec('PRAGMA foreign_keys = ON;');
    runMigrations(adapter);

    expect(() =>
      adapter.run(
        `INSERT INTO items
         (id, property_id, location_id, category, name, status, created_at, updated_at)
         VALUES (?, ?, NULL, 'other', 'Orphan', 'active', ?, ?)`,
        ['item-1', 'missing-property', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'],
      ),
    ).toThrow();
  });
});
