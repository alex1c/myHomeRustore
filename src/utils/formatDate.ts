/**
 * Russian calendar-date display helpers (DateOnly YYYY-MM-DD).
 */

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

/** Format YYYY-MM-DD as "12 мая 2026" without timezone conversion. */
export function formatRussianDate(dateOnly: string): string {
  const [yStr, mStr, dStr] = dateOnly.split('-');
  const day = Number(dStr);
  const monthIndex = Number(mStr) - 1;
  const year = Number(yStr);
  const monthName = MONTHS_GENITIVE[monthIndex];
  if (!monthName || !Number.isFinite(day) || !Number.isFinite(year)) {
    return dateOnly;
  }
  return `${day} ${monthName} ${year}`;
}
