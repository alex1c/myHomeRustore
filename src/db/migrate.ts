/**
 * Applies pending numbered migrations using SQLite PRAGMA user_version.
 */

import { StorageError } from '@/src/domain/errors';
import { nowUtcInstant } from '@/src/utils/datetime';
import { MIGRATIONS, CURRENT_SCHEMA_VERSION } from './migrations';
import type { SqlDatabase } from './types';

export function runMigrations(db: SqlDatabase): void {
  const current = db.getUserVersion();

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) {
      continue;
    }

    try {
      db.withTransaction(() => {
        migration.up(db);
        db.setUserVersion(migration.version);
        db.run(
          `INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
           VALUES (?, ?, ?)`,
          [migration.version, migration.name, nowUtcInstant()],
        );
      });
    } catch (err) {
      throw new StorageError(
        `Migration ${migration.version} (${migration.name}) failed`,
        err,
      );
    }
  }

  if (db.getUserVersion() > CURRENT_SCHEMA_VERSION) {
    throw new StorageError(
      `Database version ${db.getUserVersion()} is newer than app ${CURRENT_SCHEMA_VERSION}`,
    );
  }
}

export function getExpectedSchemaVersion(): number {
  return CURRENT_SCHEMA_VERSION;
}
