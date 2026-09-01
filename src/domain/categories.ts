/**
 * Default item categories for Phase 2 inventory.
 * Stored as Russian labels in the category column.
 */

export const DEFAULT_CATEGORIES = [
  'Бытовая техника',
  'Электроника',
  'Мебель',
  'Инструменты',
  'Сантехника',
  'Климат',
  'Освещение',
  'Посуда',
  'Другое',
] as const;

export type DefaultCategory = (typeof DEFAULT_CATEGORIES)[number];

export const DEFAULT_CATEGORY = 'Другое';

/** Resolve display label — custom categories pass through unchanged. */
export function categoryLabel(value: string): string {
  return value.trim() || DEFAULT_CATEGORY;
}

/** True when the stored value is a custom (non-default) category label. */
export function isCustomCategory(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length > 0 &&
    !(DEFAULT_CATEGORIES as readonly string[]).includes(trimmed)
  );
}
