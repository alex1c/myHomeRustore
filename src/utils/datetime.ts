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
