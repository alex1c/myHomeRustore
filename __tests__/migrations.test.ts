/**
 * Migration runner tests using sql.js in-memory SQLite.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { getExpectedSchemaVersion, runMigrations } from '@/src/db/migrate';
import { CURRENT_SCHEMA_VERSION } from '@/src/db/migrations';
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
    expect(getExpectedSchemaVersion()).toBe(1);
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
