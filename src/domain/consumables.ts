/**
 * Consumable domain constants, form values, and list filters.
 */

import type {
  ConsumableStockUnit,
  DateOnly,
  IntervalUnit,
} from '@/src/domain/types';

export const CONSUMABLE_STOCK_UNITS: readonly ConsumableStockUnit[] = [
  'pcs',
  'set',
  'pack',
] as const;

export const CONSUMABLE_STOCK_UNIT_LABELS: Record<ConsumableStockUnit, string> = {
  pcs: 'шт.',
  set: 'комплект',
  pack: 'упаковка',
};

export const DEFAULT_CONSUMABLE_REMINDER_OFFSETS = [0] as const;
export const ALL_CONSUMABLE_REMINDER_OFFSETS = [3, 1, 0] as const;

/** Today / attention window for upcoming replacements (days). */
export const CONSUMABLE_TODAY_AHEAD_DAYS = 14;

export type ConsumableFilter = 'all' | 'attention' | 'out_of_stock';

export type ConsumableDueMode = 'from_today' | 'explicit' | 'none';

export interface ConsumableFormValues {
  name: string;
  modelOrArticle: string;
  manufacturer: string;
  note: string;
  /** null = stock tracking off. */
  stockQuantity: number | null;
  stockUnit: ConsumableStockUnit;
  trackStock: boolean;
  intervalValue: number | null;
  intervalUnit: IntervalUnit | null;
  dueMode: ConsumableDueMode;
  nextDueDate: DateOnly | null;
  reminderOffsets: number[];
  remindersEnabled: boolean;
}

export const EMPTY_CONSUMABLE_FORM: ConsumableFormValues = {
  name: '',
  modelOrArticle: '',
  manufacturer: '',
  note: '',
  stockQuantity: null,
  stockUnit: 'pcs',
  trackStock: false,
  intervalValue: null,
  intervalUnit: null,
  dueMode: 'none',
  nextDueDate: null,
  reminderOffsets: [...DEFAULT_CONSUMABLE_REMINDER_OFFSETS],
  remindersEnabled: true,
};

export interface ConsumableListFilters {
  search: string;
  filter: ConsumableFilter;
}

export type ConsumableAttentionKind =
  | 'out_of_stock'
  | 'overdue'
  | 'today'
  | 'tomorrow'
  | 'upcoming'
  | 'ok'
  | 'none';
