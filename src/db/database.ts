/**
 * Application database opener — Expo production path and test helper.
 */

import { openDatabaseSync } from 'expo-sqlite';

import { PropertyRepository } from '@/src/repositories/propertyRepository';
import { createExpoSqliteAdapter } from './expoSqliteAdapter';
import { runMigrations } from './migrate';
import type { SqlDatabase } from './types';

export const APP_DATABASE_NAME = 'my_home.db';

let appDatabase: SqlDatabase | null = null;

/**
 * Opens the app database, enables foreign keys, applies migrations,
 * and ensures a default property exists (idempotent).
 */
export function openAppDatabase(): SqlDatabase {
  if (appDatabase) {
    return appDatabase;
  }

  const client = openDatabaseSync(APP_DATABASE_NAME);
  const db = createExpoSqliteAdapter(client);
  db.exec('PRAGMA foreign_keys = ON;');
  runMigrations(db);
  const properties = new PropertyRepository(db);
  properties.ensureDefaultProperty();
  appDatabase = db;
  return appDatabase;
}

/**
 * Builds a ready SqlDatabase from an adapter (used by sql.js tests).
 */
export function createDatabaseFromClient(db: SqlDatabase): SqlDatabase {
  db.exec('PRAGMA foreign_keys = ON;');
  runMigrations(db);
  const properties = new PropertyRepository(db);
  properties.ensureDefaultProperty();
  return db;
}
