/**
 * Consumable due/attention helpers — reuse shared calendar arithmetic.
 */

import type { DateOnly } from '@/src/domain/types';
import type { ConsumableAttentionKind } from '@/src/domain/consumables';
import { CONSUMABLE_TODAY_AHEAD_DAYS } from '@/src/domain/consumables';
import { isValidDateOnly, toLocalDateOnly } from '@/src/utils/datetime';
import { daysUntilDateOnly } from '@/src/utils/warrantyDate';
import {
  computeNextDueDate,
  resolveInitialNextDue,
} from '@/src/utils/maintenanceDate';

export { computeNextDueDate, resolveInitialNextDue };

export function computeConsumableAttentionKind(input: {
  stockQuantity: number | null;
  nextDueDate: DateOnly | null;
  referenceDate?: DateOnly;
  aheadDays?: number;
}): ConsumableAttentionKind {
  const ref = input.referenceDate ?? toLocalDateOnly();
  const ahead = input.aheadDays ?? CONSUMABLE_TODAY_AHEAD_DAYS;

  if (input.stockQuantity === 0) {
    return 'out_of_stock';
  }

  if (!input.nextDueDate || !isValidDateOnly(input.nextDueDate)) {
    return input.stockQuantity == null ? 'none' : 'ok';
  }

  const days = daysUntilDateOnly(input.nextDueDate, ref);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= ahead) return 'upcoming';
  return 'ok';
}

/** Priority sort key: lower = more urgent for Today/list. */
export function consumableAttentionSortKey(kind: ConsumableAttentionKind): number {
  switch (kind) {
    case 'out_of_stock':
      return 0;
    case 'overdue':
      return 1;
    case 'today':
      return 2;
    case 'tomorrow':
      return 3;
    case 'upcoming':
      return 4;
    case 'ok':
      return 5;
    default:
      return 6;
  }
}
