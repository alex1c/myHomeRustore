/**
 * Warranty domain constants and presentation labels.
 */

import type { DateOnly } from '@/src/domain/types';

/** Stored warranty type values in SQLite. */
export type WarrantyType = 'manufacturer' | 'store' | 'extended' | 'other';

export const WARRANTY_TYPES: readonly WarrantyType[] = [
  'manufacturer',
  'store',
  'extended',
  'other',
] as const;

export const WARRANTY_TYPE_LABELS: Record<WarrantyType, string> = {
  manufacturer: 'Производитель',
  store: 'Магазин',
  extended: 'Расширенная',
  other: 'Другая',
};

/** Quick duration presets shown in the warranty form (months). */
export const WARRANTY_DURATION_PRESETS = [6, 12, 24, 36] as const;

/** Default reminder offsets offered when creating a warranty (days before end). */
export const DEFAULT_WARRANTY_REMINDER_OFFSETS = [30, 7] as const;

/** Optional reminder offsets the user can enable. */
export const OPTIONAL_WARRANTY_REMINDER_OFFSETS = [14, 1] as const;

/** All supported warranty reminder offsets. */
export const ALL_WARRANTY_REMINDER_OFFSETS = [30, 14, 7, 1] as const;

/** UI threshold for "expiring soon" status (days). */
export const WARRANTY_EXPIRING_SOON_DAYS = 30;

export type WarrantyStatusKind = 'active' | 'expiring_soon' | 'expired' | 'unknown';

export interface WarrantyFormValues {
  type: WarrantyType;
  provider: string;
  startDate: DateOnly | null;
  /** Duration mode — months count when using duration input. */
  durationMonths: number | null;
  /** Explicit end date when user picks "until date" mode. */
  endDate: DateOnly | null;
  note: string;
  /** Selected reminder offsets in days before end date. */
  reminderOffsets: number[];
  remindersEnabled: boolean;
}

export const EMPTY_WARRANTY_FORM: WarrantyFormValues = {
  type: 'manufacturer',
  provider: '',
  startDate: null,
  durationMonths: 24,
  endDate: null,
  note: '',
  reminderOffsets: [...DEFAULT_WARRANTY_REMINDER_OFFSETS],
  remindersEnabled: true,
};
