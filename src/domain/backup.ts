/**
 * Backup / restore domain constants and payload shapes.
 */

export const BACKUP_FORMAT = 'myhome-backup' as const;
export const BACKUP_FORMAT_VERSION = 1 as const;
export const BACKUP_EXTENSION = 'myhomebackup' as const;

/** Soft limits against pathological archives (not enterprise ZIP-bomb defense). */
export const BACKUP_MAX_ENTRIES = 5_000;
export const BACKUP_MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;

/** Whitelisted app_settings keys that may be restored. */
export const BACKUP_SETTINGS_WHITELIST = [
  'activePropertyId',
  'themePreference',
] as const;

export type BackupSettingsKey = (typeof BACKUP_SETTINGS_WHITELIST)[number];

export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  createdAt: string;
  appVersion: string;
  schemaVersion: number;
  backupId: string;
  /** Informational only — preview counts come from validated data. */
  counts?: BackupPreviewCounts;
  fileCount?: number;
  warnings?: string[];
}

export interface BackupPreviewCounts {
  properties: number;
  locations: number;
  items: number;
  purchases: number;
  warranties: number;
  documents: number;
  maintenanceRules: number;
  maintenanceEvents: number;
  consumables: number;
  consumableEvents: number;
  reminders: number;
}

/** Snake_case rows matching SQLite columns for portable JSON. */
export interface BackupDataJson {
  properties: Record<string, unknown>[];
  locations: Record<string, unknown>[];
  items: Record<string, unknown>[];
  purchases: Record<string, unknown>[];
  warranties: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  maintenance_rules: Record<string, unknown>[];
  maintenance_events: Record<string, unknown>[];
  consumables: Record<string, unknown>[];
  consumable_events: Record<string, unknown>[];
  reminders: Record<string, unknown>[];
  app_settings: { key: string; value: string }[];
}

export interface BackupPreview {
  manifest: BackupManifest;
  counts: BackupPreviewCounts;
  warnings: string[];
}

export type BackupBusyGuard = 'idle' | 'backup' | 'restore';
