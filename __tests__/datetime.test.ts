/**
 * Date-only parsing and comparison tests.
 */

import {
  addDaysToDateOnly,
  compareDateOnly,
  isValidDateOnly,
  toLocalDateOnly,
} from '@/src/utils/datetime';

describe('datetime', () => {
  test('validates correct calendar dates', () => {
    expect(isValidDateOnly('2024-02-29')).toBe(true);
    expect(isValidDateOnly('2026-09-01')).toBe(true);
  });

  test('rejects invalid calendar dates', () => {
    expect(isValidDateOnly('2024-02-30')).toBe(false);
    expect(isValidDateOnly('2023-02-29')).toBe(false);
    for (const invalid of ['2026-02-30', '2026-13-01', '2026-00-10', '2026-01-00', '01.09.2026', '2026-1-1', 'abcd']) {
      expect(isValidDateOnly(invalid)).toBe(false);
    }
  });

  test('compares dates chronologically', () => {
    expect(compareDateOnly('2024-01-01', '2024-12-31')).toBeLessThan(0);
    expect(compareDateOnly('2024-06-01', '2024-06-01')).toBe(0);
    expect(compareDateOnly('2025-01-01', '2024-12-31')).toBeGreaterThan(0);
  });

  test('adds days across month boundary', () => {
    expect(addDaysToDateOnly('2024-01-30', 3)).toBe('2024-02-02');
  });

  test('leap year Feb 29 is valid', () => {
    expect(isValidDateOnly('2024-02-29')).toBe(true);
    expect(isValidDateOnly('2025-02-29')).toBe(false);
  });

  test('toLocalDateOnly returns YYYY-MM-DD', () => {
    const value = toLocalDateOnly(new Date(2024, 5, 3));
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
