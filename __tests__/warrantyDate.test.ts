/**
 * Warranty calendar-date arithmetic and status tests.
 */

import {
  addMonthsToDateOnly,
  computeWarrantyStatus,
  daysUntilDateOnly,
  resolveWarrantyEndDate,
} from '@/src/utils/warrantyDate';
import { toLocalDateOnly } from '@/src/utils/datetime';

describe('warrantyDate', () => {
  test('month-end clamp: 2026-01-31 + 1 month', () => {
    expect(addMonthsToDateOnly('2026-01-31', 1)).toBe('2026-02-28');
  });

  test('leap year clamp: 2024-01-31 + 1 month', () => {
    expect(addMonthsToDateOnly('2024-01-31', 1)).toBe('2024-02-29');
  });

  test('2026-08-31 + 6 months', () => {
    expect(addMonthsToDateOnly('2026-08-31', 6)).toBe('2027-02-28');
  });

  test('2026-02-28 + 12 months', () => {
    expect(addMonthsToDateOnly('2026-02-28', 12)).toBe('2027-02-28');
  });

  test('resolve end date from duration', () => {
    expect(
      resolveWarrantyEndDate({
        endDate: null,
        startDate: '2026-08-15',
        durationMonths: 24,
      }),
    ).toBe('2028-08-15');
  });

  test('explicit end date is authoritative', () => {
    expect(
      resolveWarrantyEndDate({
        endDate: '2028-12-01',
        startDate: '2026-08-15',
        durationMonths: 24,
      }),
    ).toBe('2028-12-01');
  });

  test('status active when end date is far', () => {
    expect(computeWarrantyStatus('2030-01-01', '2026-09-01')).toBe('active');
  });

  test('status expiring soon within 30 days', () => {
    expect(computeWarrantyStatus('2026-09-15', '2026-09-01')).toBe('expiring_soon');
  });

  test('status expiring soon tomorrow', () => {
    expect(computeWarrantyStatus('2026-09-02', '2026-09-01')).toBe('expiring_soon');
  });

  test('status active on end date (inclusive policy)', () => {
    expect(computeWarrantyStatus('2026-09-01', '2026-09-01')).toBe('expiring_soon');
    expect(daysUntilDateOnly('2026-09-01', '2026-09-01')).toBe(0);
  });

  test('status expired after end date', () => {
    expect(computeWarrantyStatus('2026-08-31', '2026-09-01')).toBe('expired');
  });

  test('days until end date', () => {
    expect(daysUntilDateOnly('2026-09-10', '2026-09-01')).toBe(9);
  });

  test('today helper produces valid date-only', () => {
    expect(toLocalDateOnly(new Date(2026, 8, 1, 15, 30))).toBe('2026-09-01');
  });
});
