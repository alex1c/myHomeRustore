/**
 * Consumable template matching and calendar reuse.
 */

import { suggestConsumableTemplates } from '@/src/domain/consumableTemplates';
import { computeNextDueDate } from '@/src/utils/consumableDate';
import { addMonthsToDateOnly } from '@/src/utils/datetime';

describe('consumableTemplates', () => {
  test('robot vacuum suggestions include HEPA and exclude generic vacuum bags group clash', () => {
    const templates = suggestConsumableTemplates({
      name: 'Робот-пылесос Dreame',
    });
    expect(templates.some((t) => t.name === 'HEPA-фильтр')).toBe(true);
    expect(templates.some((t) => t.group === 'Пылесос')).toBe(false);
  });

  test('dishwasher stock-only templates', () => {
    const templates = suggestConsumableTemplates({
      name: 'Посудомоечная машина',
    });
    expect(templates.some((t) => t.name === 'Таблетки' && t.intervalValue == null)).toBe(
      true,
    );
  });
});

describe('consumable calendar', () => {
  test('month-end clamp via shared helper', () => {
    expect(addMonthsToDateOnly('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToDateOnly('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonthsToDateOnly('2026-08-31', 6)).toBe('2027-02-28');
    expect(computeNextDueDate('2026-09-02', 3, 'month')).toBe('2026-12-02');
  });
});
