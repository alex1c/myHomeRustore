/**
 * Abstract SQL database interface used by migrations and repositories.
 */

export type SqlRunResult = {
  changes: number;
  lastInsertRowId: number;
};

export interface SqlDatabase {
  exec(sql: string): void;
  run(sql: string, params?: unknown[]): SqlRunResult;
  getAll<T>(sql: string, params?: unknown[]): T[];
  getFirst<T>(sql: string, params?: unknown[]): T | null;
  withTransaction<T>(fn: () => T): T;
  getUserVersion(): number;
  setUserVersion(version: number): void;
}

export interface Migration {
  version: number;
  name: string;
  up: (db: SqlDatabase) => void;
}
