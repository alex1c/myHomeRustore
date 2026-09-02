/**
 * Maintenance domain constants, form values, and list filters.
 */

import type { DateOnly, IntervalUnit } from '@/src/domain/types';

/** Popular title presets for the create form. */
export const MAINTENANCE_TITLE_PRESETS = [
  'Очистить фильтр',
  'Заменить фильтр',
  'Очистить от накипи',
  'Почистить',
  'Проверить',
  'Провести обслуживание',
  'Заменить расходник',
  'Другое',
] as const;

/** Default reminder: on the due day at 09:00 (offset 0). */
export const DEFAULT_MAINTENANCE_REMINDER_OFFSETS = [0] as const;

/** Optional reminder offsets (days before due). */
export const OPTIONAL_MAINTENANCE_REMINDER_OFFSETS = [1, 3] as const;

export const ALL_MAINTENANCE_REMINDER_OFFSETS = [3, 1, 0] as const;

/** Today tab forward window for upcoming maintenance (days). */
export const MAINTENANCE_TODAY_AHEAD_DAYS = 14;

export type MaintenanceFilter = 'all' | 'overdue' | 'upcoming';

export type MaintenanceDueMode = 'from_today' | 'explicit';

export interface MaintenanceFormValues {
  title: string;
  note: string;
  intervalValue: number | null;
  intervalUnit: IntervalUnit | null;
  dueMode: MaintenanceDueMode;
  /** Used when dueMode === 'explicit'. */
  nextDueDate: DateOnly | null;
  reminderOffsets: number[];
  remindersEnabled: boolean;
}

export const EMPTY_MAINTENANCE_FORM: MaintenanceFormValues = {
  title: '',
  note: '',
  intervalValue: 30,
  intervalUnit: 'day',
  dueMode: 'from_today',
  nextDueDate: null,
  reminderOffsets: [...DEFAULT_MAINTENANCE_REMINDER_OFFSETS],
  remindersEnabled: true,
};

export type MaintenanceDueKind =
  | 'overdue'
  | 'today'
  | 'tomorrow'
  | 'upcoming'
  | 'none';

export interface MaintenanceListFilters {
  search: string;
  filter: MaintenanceFilter;
}
