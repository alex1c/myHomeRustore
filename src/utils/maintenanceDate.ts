/**
 * Maintenance recurrence and due-status calculation.
 *
 * Next-due policy: computed from the actual completion date (not the planned due).
 */

import type { DateOnly, IntervalUnit, MaintenanceRule } from '@/src/domain/types';
import type { MaintenanceDueKind } from '@/src/domain/maintenance';
import {
  addDaysToDateOnly,
  addMonthsToDateOnly,
  isValidDateOnly,
  toLocalDateOnly,
} from '@/src/utils/datetime';
import { daysUntilDateOnly } from '@/src/utils/warrantyDate';

/** Compute next due date from a completion/baseline date and interval. */
export function computeNextDueDate(
  fromDate: DateOnly,
  intervalValue: number | null,
  intervalUnit: IntervalUnit | null,
): DateOnly | null {
  if (!isValidDateOnly(fromDate)) {
    throw new Error(`Invalid date-only value: ${fromDate}`);
  }
  if (intervalValue == null || intervalValue <= 0 || !intervalUnit) {
    return null;
  }

  switch (intervalUnit) {
    case 'day':
      return addDaysToDateOnly(fromDate, intervalValue);
    case 'week':
      return addDaysToDateOnly(fromDate, intervalValue * 7);
    case 'month':
      return addMonthsToDateOnly(fromDate, intervalValue);
    case 'year':
      return addMonthsToDateOnly(fromDate, intervalValue * 12);
    default:
      return null;
  }
}

/**
 * Initial next-due when creating a rule.
 * from_today + interval → today + interval; without interval → today.
 * explicit → user-provided date.
 */
export function resolveInitialNextDue(input: {
  dueMode: 'from_today' | 'explicit';
  nextDueDate: DateOnly | null;
  intervalValue: number | null;
  intervalUnit: IntervalUnit | null;
  today?: DateOnly;
}): DateOnly | null {
  const today = input.today ?? toLocalDateOnly();
  if (input.dueMode === 'explicit') {
    return input.nextDueDate && isValidDateOnly(input.nextDueDate)
      ? input.nextDueDate
      : null;
  }
  const computed = computeNextDueDate(
    today,
    input.intervalValue,
    input.intervalUnit,
  );
  return computed ?? today;
}

export function computeMaintenanceDueKind(
  nextDueDate: DateOnly | null,
  referenceDate: DateOnly = toLocalDateOnly(),
): MaintenanceDueKind {
  if (!nextDueDate || !isValidDateOnly(nextDueDate)) {
    return 'none';
  }
  const days = daysUntilDateOnly(nextDueDate, referenceDate);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return 'upcoming';
}

/** Fire date for a maintenance reminder offset (0 = due day) at 09:00 local. */
export function maintenanceReminderFireDate(
  dueDate: DateOnly,
  offsetDays: number,
): Date {
  const dateOnly = addDaysToDateOnly(dueDate, -offsetDays);
  const [y, m, d] = dateOnly.split('-').map(Number);
  return new Date(y, m - 1, d, 9, 0, 0, 0);
}

export function isFutureMaintenanceReminderOffset(
  dueDate: DateOnly,
  offsetDays: number,
  now: Date = new Date(),
): boolean {
  return maintenanceReminderFireDate(dueDate, offsetDays).getTime() > now.getTime();
}

/** Recompute next due from the latest completion date when interval exists. */
export function recomputeNextDueFromLatestCompletion(input: {
  rule: Pick<MaintenanceRule, 'intervalValue' | 'intervalUnit'>;
  latestCompletionDate: DateOnly | null;
  fallbackNextDue: DateOnly | null;
}): DateOnly | null {
  if (input.latestCompletionDate) {
    const next = computeNextDueDate(
      input.latestCompletionDate,
      input.rule.intervalValue,
      input.rule.intervalUnit,
    );
    if (next) return next;
  }
  return input.fallbackNextDue;
}
