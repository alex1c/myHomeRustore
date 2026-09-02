/**
 * Maintenance recurrence and due-status unit tests.
 */

import {
  computeMaintenanceDueKind,
  computeNextDueDate,
  resolveInitialNextDue,
} from '@/src/utils/maintenanceDate';
import { addMonthsToDateOnly, addDaysToDateOnly } from '@/src/utils/datetime';

describe('maintenanceDate', () => {
  test('month-end clamp reused from shared calendar', () => {
    expect(addMonthsToDateOnly('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToDateOnly('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonthsToDateOnly('2026-08-31', 6)).toBe('2027-02-28');
  });

  test('day interval without timezone shift', () => {
    expect(addDaysToDateOnly('2026-09-02', 30)).toBe('2026-10-02');
    expect(computeNextDueDate('2026-09-02', 30, 'day')).toBe('2026-10-02');
  });

  test('month interval from completion date', () => {
    expect(computeNextDueDate('2026-09-05', 1, 'month')).toBe('2026-10-05');
    expect(computeNextDueDate('2026-01-31', 1, 'month')).toBe('2026-02-28');
  });

  test('initial due from today uses interval', () => {
    expect(
      resolveInitialNextDue({
        dueMode: 'from_today',
        nextDueDate: null,
        intervalValue: 30,
        intervalUnit: 'day',
        today: '2026-09-01',
      }),
    ).toBe('2026-10-01');
  });

  test('explicit due date wins', () => {
    expect(
      resolveInitialNextDue({
        dueMode: 'explicit',
        nextDueDate: '2026-09-15',
        intervalValue: 30,
        intervalUnit: 'day',
        today: '2026-09-01',
      }),
    ).toBe('2026-09-15');
  });

  test('due status kinds', () => {
    expect(computeMaintenanceDueKind('2026-08-20', '2026-09-01')).toBe('overdue');
    expect(computeMaintenanceDueKind('2026-09-01', '2026-09-01')).toBe('today');
    expect(computeMaintenanceDueKind('2026-09-02', '2026-09-01')).toBe('tomorrow');
    expect(computeMaintenanceDueKind('2026-09-10', '2026-09-01')).toBe('upcoming');
    expect(computeMaintenanceDueKind(null, '2026-09-01')).toBe('none');
  });
});
