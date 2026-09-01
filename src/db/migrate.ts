/**
 * Applies pending numbered migrations using SQLite PRAGMA user_version.
 */

import { StorageError } from '@/src/domain/errors';
import { nowUtcInstant } from '@/src/utils/datetime';
import { MIGRATIONS, CURRENT_SCHEMA_VERSION } from './migrations';
import type { SqlDatabase } from './types';

export function runMigrations(db: SqlDatabase): void {
  const current = db.getUserVersion();

  if (current > CURRENT_SCHEMA_VERSION) {
    throw new StorageError(
      `Database version ${current} is newer than app ${CURRENT_SCHEMA_VERSION}`,
    );
  }

  for (let index = 0; index < MIGRATIONS.length; index += 1) {
    if (MIGRATIONS[index]?.version !== index + 1) {
      throw new StorageError('Migration list must contain consecutive versions starting at 1');
    }
  }

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) {
      continue;
    }

    try {
      db.withTransaction(() => {
        migration.up(db);
        db.setUserVersion(migration.version);
        db.run(
          `INSERT INTO schema_migrations (version, name, applied_at)
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

  for (const migration of MIGRATIONS) {
    if (migration.version > db.getUserVersion()) break;
    const applied = db.getFirst<{ name: string }>(
      'SELECT name FROM schema_migrations WHERE version = ?',
      [migration.version],
    );
    if (applied?.name !== migration.name) {
      throw new StorageError(
        `Migration history mismatch at version ${migration.version}`,
      );
    }
  }
}

export function getExpectedSchemaVersion(): number {
  return CURRENT_SCHEMA_VERSION;
}
