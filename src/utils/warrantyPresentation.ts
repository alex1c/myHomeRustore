/**
 * Human-readable warranty status and duration labels (Russian UI).
 */

import type { DateOnly } from '@/src/domain/types';
import type { WarrantyType, WarrantyStatusKind } from '@/src/domain/warranty';
import { WARRANTY_TYPE_LABELS } from '@/src/domain/warranty';
import { formatRussianDate } from '@/src/utils/formatDate';
import {
  computeWarrantyStatus,
  daysUntilDateOnly,
  resolveWarrantyEndDate,
} from '@/src/utils/warrantyDate';
import { toLocalDateOnly } from '@/src/utils/datetime';

export function warrantyTypeLabel(type: string): string {
  return WARRANTY_TYPE_LABELS[type as WarrantyType] ?? type;
}

export interface WarrantyStatusPresentation {
  kind: WarrantyStatusKind;
  /** Primary status line, e.g. "Действует". */
  label: string;
  /** Secondary detail, e.g. "Заканчивается через 12 дней". */
  detail: string | null;
}

function pluralDays(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня';
  return 'дней';
}

function pluralMonths(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'месяц';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'месяца';
  return 'месяцев';
}

function pluralYears(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'год';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'года';
  return 'лет';
}

/** Friendly remaining-time text for active warranties. */
export function formatRemainingTime(endDate: DateOnly, referenceDate?: DateOnly): string {
  const ref = referenceDate ?? toLocalDateOnly();
  const daysLeft = daysUntilDateOnly(endDate, ref);
  if (daysLeft === 0) {
    return 'Заканчивается сегодня';
  }
  if (daysLeft < 30) {
    return `Действует ещё ${daysLeft} ${pluralDays(daysLeft)}`;
  }
  const monthsLeft = Math.floor(daysLeft / 30);
  if (monthsLeft < 12) {
    return `Действует ещё ${monthsLeft} ${pluralMonths(monthsLeft)}`;
  }
  const years = Math.floor(monthsLeft / 12);
  const months = monthsLeft % 12;
  if (months === 0) {
    return `Действует ещё ${years} ${pluralYears(years)}`;
  }
  return `Действует ещё ${years} ${pluralYears(years)} ${months} ${pluralMonths(months)}`;
}

export function presentWarrantyStatus(
  warranty: {
    endDate: DateOnly | null;
    startDate: DateOnly | null;
    durationMonths: number | null;
  },
  referenceDate: DateOnly = toLocalDateOnly(),
): WarrantyStatusPresentation {
  const resolvedEnd = resolveWarrantyEndDate(warranty);
  if (!resolvedEnd) {
    return { kind: 'unknown', label: 'Срок не указан', detail: null };
  }

  const kind = computeWarrantyStatus(resolvedEnd, referenceDate);
  const daysLeft = daysUntilDateOnly(resolvedEnd, referenceDate);
  const daysAgo = -daysLeft;

  if (kind === 'active') {
    return {
      kind,
      label: 'Действует',
      detail: formatRemainingTime(resolvedEnd, referenceDate),
    };
  }
  if (kind === 'expiring_soon') {
    if (daysLeft === 0) {
      return { kind, label: 'Заканчивается сегодня', detail: `до ${formatRussianDate(resolvedEnd)}` };
    }
    return {
      kind,
      label: `Заканчивается через ${daysLeft} ${pluralDays(daysLeft)}`,
      detail: `до ${formatRussianDate(resolvedEnd)}`,
    };
  }
  if (kind === 'expired') {
    if (daysAgo === 0) {
      return { kind, label: 'Истекла сегодня', detail: formatRussianDate(resolvedEnd) };
    }
    return {
      kind,
      label: `Истекла ${daysAgo} ${pluralDays(daysAgo)} назад`,
      detail: formatRussianDate(resolvedEnd),
    };
  }
  return { kind: 'unknown', label: 'Срок не указан', detail: null };
}
