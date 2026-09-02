/**
 * Warranty calendar-date arithmetic and status calculation.
 *
 * Policy:
 * - End date is inclusive — warranty is active through the end calendar day.
 * - Month addition clamps day-of-month to the last valid day of the target month.
 */

import type { DateOnly } from '@/src/domain/types';
import {
  WARRANTY_EXPIRING_SOON_DAYS,
  type WarrantyStatusKind,
} from '@/src/domain/warranty';
import {
  addDaysToDateOnly,
  compareDateOnly,
  isValidDateOnly,
  toLocalDateOnly,
} from '@/src/utils/datetime';

/**
 * Add calendar months to a date-only value with month-end clamping.
 * Example: 2026-01-31 + 1 month → 2026-02-28.
 */
export function addMonthsToDateOnly(dateOnly: DateOnly, months: number): DateOnly {
  if (!isValidDateOnly(dateOnly)) {
    throw new Error(`Invalid date-only value: ${dateOnly}`);
  }
  if (!Number.isInteger(months)) {
    throw new Error(`Months must be an integer, got: ${months}`);
  }

  const [yStr, mStr, dStr] = dateOnly.split('-');
  const startYear = Number(yStr);
  const startMonthIndex = Number(mStr) - 1;
  const startDay = Number(dStr);

  const totalMonths = startMonthIndex + months;
  const targetYear = startYear + Math.floor(totalMonths / 12);
  const normalizedMonthIndex = ((totalMonths % 12) + 12) % 12;

  const lastDayOfTargetMonth = new Date(
    targetYear,
    normalizedMonthIndex + 1,
    0,
    12,
    0,
    0,
    0,
  ).getDate();
  const clampedDay = Math.min(startDay, lastDayOfTargetMonth);

  const result = new Date(targetYear, normalizedMonthIndex, clampedDay, 12, 0, 0, 0);
  return toLocalDateOnly(result);
}

/** Resolve authoritative warranty end date from stored fields. */
export function resolveWarrantyEndDate(input: {
  endDate: DateOnly | null;
  startDate: DateOnly | null;
  durationMonths: number | null;
}): DateOnly | null {
  if (input.endDate && isValidDateOnly(input.endDate)) {
    return input.endDate;
  }
  if (
    input.startDate &&
    isValidDateOnly(input.startDate) &&
    input.durationMonths != null &&
    input.durationMonths > 0
  ) {
    return addMonthsToDateOnly(input.startDate, input.durationMonths);
  }
  return null;
}

/** Whole calendar days from reference date to end date (positive = future). */
export function daysUntilDateOnly(
  endDate: DateOnly,
  referenceDate: DateOnly = toLocalDateOnly(),
): number {
  if (!isValidDateOnly(endDate) || !isValidDateOnly(referenceDate)) {
    throw new Error('daysUntilDateOnly requires valid dates');
  }
  const [ey, em, ed] = endDate.split('-').map(Number);
  const [ry, rm, rd] = referenceDate.split('-').map(Number);
  const endMs = Date.UTC(ey, em - 1, ed);
  const refMs = Date.UTC(ry, rm - 1, rd);
  return Math.round((endMs - refMs) / 86_400_000);
}

/** Compute warranty status relative to a calendar reference date. */
export function computeWarrantyStatus(
  endDate: DateOnly | null,
  referenceDate: DateOnly = toLocalDateOnly(),
): WarrantyStatusKind {
  if (!endDate || !isValidDateOnly(endDate)) {
    return 'unknown';
  }
  const cmp = compareDateOnly(referenceDate, endDate);
  if (cmp > 0) {
    return 'expired';
  }
  const daysLeft = daysUntilDateOnly(endDate, referenceDate);
  if (daysLeft <= WARRANTY_EXPIRING_SOON_DAYS) {
    return 'expiring_soon';
  }
  return 'active';
}

/** Notification fire date: N days before end date at 09:00 local time. */
export function warrantyReminderFireDate(
  endDate: DateOnly,
  offsetDays: number,
): Date {
  const dateOnly = addDaysToDateOnly(endDate, -offsetDays);
  const [y, m, d] = dateOnly.split('-').map(Number);
  return new Date(y, m - 1, d, 9, 0, 0, 0);
}

/** True when a reminder offset is still in the future relative to now. */
export function isFutureWarrantyReminderOffset(
  endDate: DateOnly,
  offsetDays: number,
  now: Date = new Date(),
): boolean {
  const fireAt = warrantyReminderFireDate(endDate, offsetDays);
  return fireAt.getTime() > now.getTime();
}
