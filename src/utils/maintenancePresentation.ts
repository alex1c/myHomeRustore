/**
 * Human-readable maintenance due status labels (Russian UI).
 */

import type { DateOnly, IntervalUnit } from '@/src/domain/types';
import { formatIntervalLabel } from '@/src/domain/maintenanceTemplates';
import {
  computeMaintenanceDueKind,
} from '@/src/utils/maintenanceDate';
import { daysUntilDateOnly } from '@/src/utils/warrantyDate';
import { toLocalDateOnly } from '@/src/utils/datetime';
import { formatRussianDate } from '@/src/utils/formatDate';

function pluralDays(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня';
  return 'дней';
}

export interface MaintenanceStatusPresentation {
  kind: ReturnType<typeof computeMaintenanceDueKind>;
  label: string;
  detail: string | null;
}

export function presentMaintenanceStatus(
  nextDueDate: DateOnly | null,
  referenceDate: DateOnly = toLocalDateOnly(),
): MaintenanceStatusPresentation {
  const kind = computeMaintenanceDueKind(nextDueDate, referenceDate);
  if (!nextDueDate || kind === 'none') {
    return { kind: 'none', label: 'Дата не указана', detail: null };
  }

  const days = daysUntilDateOnly(nextDueDate, referenceDate);

  if (kind === 'overdue') {
    const overdue = Math.abs(days);
    return {
      kind,
      label: `Просрочено на ${overdue} ${pluralDays(overdue)}`,
      detail: formatRussianDate(nextDueDate),
    };
  }
  if (kind === 'today') {
    return { kind, label: 'Сегодня', detail: formatRussianDate(nextDueDate) };
  }
  if (kind === 'tomorrow') {
    return { kind, label: 'Завтра', detail: formatRussianDate(nextDueDate) };
  }
  return {
    kind,
    label: `Через ${days} ${pluralDays(days)}`,
    detail: formatRussianDate(nextDueDate),
  };
}

export function presentInterval(
  intervalValue: number | null,
  intervalUnit: IntervalUnit | null,
): string | null {
  if (intervalValue == null || !intervalUnit) return null;
  return formatIntervalLabel(intervalValue, intervalUnit);
}
