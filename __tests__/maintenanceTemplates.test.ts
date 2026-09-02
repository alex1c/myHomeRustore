/**
 * Suggested maintenance template matching tests.
 */

import { suggestMaintenanceTemplates } from '@/src/domain/maintenanceTemplates';

describe('maintenanceTemplates', () => {
  test('matches coffee machine keywords', () => {
    const templates = suggestMaintenanceTemplates({
      category: 'Кухня',
      name: 'Кофемашина DeLonghi',
    });
    expect(templates.some((t) => t.title.includes('накипи'))).toBe(true);
    expect(templates.every((t) => t.group === 'Кофемашина')).toBe(true);
  });

  test('robot vacuum does not include generic vacuum templates', () => {
    const templates = suggestMaintenanceTemplates({
      name: 'Робот-пылесос Dreame',
    });
    expect(templates.some((t) => t.group === 'Робот-пылесос')).toBe(true);
    expect(templates.some((t) => t.group === 'Пылесос')).toBe(false);
  });

  test('returns empty when no match', () => {
    expect(
      suggestMaintenanceTemplates({ category: 'Мебель', name: 'Диван' }),
    ).toHaveLength(0);
  });
});
