/**
 * Human-readable consumable stock and due labels (Russian UI).
 */

import type { Consumable, ConsumableEvent, ConsumableStockUnit } from '@/src/domain/types';
import {
  CONSUMABLE_STOCK_UNIT_LABELS,
  type ConsumableAttentionKind,
} from '@/src/domain/consumables';
import { computeConsumableAttentionKind } from '@/src/utils/consumableDate';
import { daysUntilDateOnly } from '@/src/utils/warrantyDate';
import { toLocalDateOnly, utcInstantToDateOnly } from '@/src/utils/datetime';
import { formatRussianDate } from '@/src/utils/formatDate';

function pluralPcs(count: number): string {
  const m10 = count % 10;
  const m100 = count % 100;
  if (m10 === 1 && m100 !== 11) return 'шт.';
  return 'шт.';
}

function pluralDays(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня';
  return 'дней';
}

export function stockUnitLabel(unit: ConsumableStockUnit | null): string {
  if (!unit) return 'шт.';
  return CONSUMABLE_STOCK_UNIT_LABELS[unit];
}

export function presentStock(consumable: Pick<Consumable, 'stockQuantity' | 'stockUnit'>): string | null {
  if (consumable.stockQuantity == null) {
    return null;
  }
  const unit = stockUnitLabel(consumable.stockUnit);
  if (consumable.stockQuantity === 0) {
    return 'Запас закончился';
  }
  if (consumable.stockQuantity === 1) {
    return unit === 'шт.' ? 'Осталась 1 шт.' : `Остался 1 ${unit}`;
  }
  return `В запасе: ${consumable.stockQuantity} ${unit === 'шт.' ? pluralPcs(consumable.stockQuantity) : unit}`;
}

export interface ConsumableStatusPresentation {
  kind: ConsumableAttentionKind;
  primary: string;
  secondary: string | null;
}

export function presentConsumableStatus(
  consumable: Pick<Consumable, 'stockQuantity' | 'stockUnit' | 'nextDueDate'>,
  referenceDate: string = toLocalDateOnly(),
): ConsumableStatusPresentation {
  const kind = computeConsumableAttentionKind({
    stockQuantity: consumable.stockQuantity,
    nextDueDate: consumable.nextDueDate,
    referenceDate,
  });

  const stockLine = presentStock(consumable);
  let dueLine: string | null = null;

  if (consumable.nextDueDate) {
    const days = daysUntilDateOnly(consumable.nextDueDate, referenceDate);
    if (days < 0) {
      dueLine = `Замена просрочена на ${Math.abs(days)} ${pluralDays(Math.abs(days))}`;
    } else if (days === 0) {
      dueLine = 'Замена сегодня';
    } else if (days === 1) {
      dueLine = 'Замена завтра';
    } else {
      dueLine = `Замена через ${days} ${pluralDays(days)}`;
    }
  }

  if (kind === 'out_of_stock') {
    return {
      kind,
      primary: stockLine ?? 'Запас закончился',
      secondary: dueLine,
    };
  }

  if (dueLine) {
    return {
      kind,
      primary: dueLine,
      secondary: stockLine,
    };
  }

  if (stockLine) {
    return { kind, primary: stockLine, secondary: null };
  }

  return { kind: 'none', primary: 'Расписание не задано', secondary: null };
}

export function presentConsumableEvent(event: ConsumableEvent): {
  title: string;
  detail: string | null;
  dateLabel: string;
} {
  const date = utcInstantToDateOnly(event.replacedAt);
  const dateLabel = date ? formatRussianDate(date) : event.replacedAt;

  if (event.eventType === 'replacement') {
    let detail: string | null = null;
    if (event.stockBefore != null && event.stockAfter != null) {
      detail = `Запас: ${event.stockBefore} → ${event.stockAfter}`;
    }
    if (event.note) {
      detail = detail ? `${detail}\n${event.note}` : event.note;
    }
    return { title: 'Заменён', detail, dateLabel };
  }

  if (event.eventType === 'stock_add') {
    const delta = event.quantityDelta ?? 0;
    let detail =
      event.stockBefore != null && event.stockAfter != null
        ? `Было ${event.stockBefore} → стало ${event.stockAfter}`
        : `+${delta}`;
    if (event.note) detail = `${detail}\n${event.note}`;
    return { title: `Добавлено в запас +${delta}`, detail, dateLabel };
  }

  // stock_set
  let detail =
    event.stockBefore != null && event.stockAfter != null
      ? `Было ${event.stockBefore} → стало ${event.stockAfter}`
      : null;
  if (event.note) {
    detail = detail ? `${detail}\n${event.note}` : event.note;
  }
  return { title: 'Изменён запас', detail, dateLabel };
}
