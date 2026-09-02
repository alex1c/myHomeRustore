/**
 * Date/time helpers for «Мой дом».
 *
 * Storage rules:
 * - Calendar dates: YYYY-MM-DD (DateOnly)
 * - Audit timestamps: ISO-8601 UTC (...Z)
 */

import type { DateOnly, UtcInstant } from '@/src/domain/types';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function nowUtcInstant(date: Date = new Date()): UtcInstant {
  return date.toISOString();
}

export function isValidDateOnly(value: string): value is DateOnly {
  if (!DATE_ONLY_RE.test(value)) {
    return false;
  }
  const [yStr, mStr, dStr] = value.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return false;
  }
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

export function compareDateOnly(a: DateOnly, b: DateOnly): number {
  if (!isValidDateOnly(a) || !isValidDateOnly(b)) {
    throw new Error(`compareDateOnly requires valid dates, got: ${a}, ${b}`);
  }
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function toLocalDateOnly(date: Date = new Date()): DateOnly {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToDateOnly(dateOnly: DateOnly, deltaDays: number): DateOnly {
  if (!isValidDateOnly(dateOnly)) {
    throw new Error(`Invalid date-only value: ${dateOnly}`);
  }
  const [yStr, mStr, dStr] = dateOnly.split('-');
  const dt = new Date(Number(yStr), Number(mStr) - 1, Number(dStr), 12, 0, 0, 0);
  dt.setDate(dt.getDate() + deltaDays);
  return toLocalDateOnly(dt);
}

/**
 * Add calendar months with month-end clamping.
 * Example: 2026-01-31 + 1 month → 2026-02-28.
 * Shared by warranties, maintenance, and future consumables.
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

/** Store a calendar date as a noon-UTC instant to avoid timezone day shifts. */
export function dateOnlyToUtcNoon(dateOnly: DateOnly): UtcInstant {
  if (!isValidDateOnly(dateOnly)) {
    throw new Error(`Invalid date-only value: ${dateOnly}`);
  }
  return `${dateOnly}T12:00:00.000Z`;
}

/** Extract YYYY-MM-DD from a stored UTC instant (first 10 chars). */
export function utcInstantToDateOnly(instant: string): DateOnly | null {
  const candidate = instant.slice(0, 10);
  return isValidDateOnly(candidate) ? candidate : null;
}
