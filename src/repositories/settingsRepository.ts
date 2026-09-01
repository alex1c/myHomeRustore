/**
 * Settings repository — typed key/value app preferences.
 */

import type { SqlDatabase } from '@/src/db/types';

export const SETTINGS_KEYS = {
  activePropertyId: 'activePropertyId',
  themePreference: 'themePreference',
} as const;

export class SettingsRepository {
  constructor(private readonly db: SqlDatabase) {}

  get(key: string): string | null {
    const row = this.db.getFirst<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      [key],
    );
    return row?.value ?? null;
  }

  set(key: string, value: string): void {
    this.db.run(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    );
  }

  getActivePropertyId(): string | null {
    return this.get(SETTINGS_KEYS.activePropertyId);
  }

  setActivePropertyId(propertyId: string): void {
    this.set(SETTINGS_KEYS.activePropertyId, propertyId);
  }
}
