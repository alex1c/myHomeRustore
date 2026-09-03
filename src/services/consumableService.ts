/**
 * Consumable orchestration — stock, replacement, reminders.
 *
 * DB transaction covers event + consumable state.
 * OS notifications run after commit with Phase-3 compensation patterns.
 */

import { AppError } from '@/src/domain/errors';
import type {
  Consumable,
  ConsumableEvent,
  DateOnly,
  IntervalUnit,
} from '@/src/domain/types';
import {
  ALL_CONSUMABLE_REMINDER_OFFSETS,
  type ConsumableFormValues,
  type ConsumableListFilters,
} from '@/src/domain/consumables';
import type { SqlDatabase } from '@/src/db/types';
import {
  ConsumableRepository,
  type ConsumableListRow,
} from '@/src/repositories/consumableRepository';
import { ItemRepository } from '@/src/repositories/itemRepository';
import { ReminderRepository } from '@/src/repositories/reminderRepository';
import type { NotificationAdapter } from '@/src/services/notificationAdapter';
import {
  ConsumableReminderService,
  type ConsumableReminderScheduleResult,
} from '@/src/services/consumableReminderService';
import {
  computeNextDueDate,
  resolveInitialNextDue,
} from '@/src/utils/consumableDate';
import {
  toLocalDateOnly,
  utcInstantToDateOnly,
} from '@/src/utils/datetime';
import { daysUntilDateOnly } from '@/src/utils/warrantyDate';

export type ConsumableSaveResult = {
  consumable: Consumable;
  reminders: ConsumableReminderScheduleResult;
};

export type MarkReplacedResult = {
  event: ConsumableEvent;
  consumable: Consumable;
  reminders: ConsumableReminderScheduleResult;
  stockWasZero: boolean;
};

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateReminderOffsets(offsets: number[]): void {
  const allowed = new Set<number>(ALL_CONSUMABLE_REMINDER_OFFSETS);
  if (
    new Set(offsets).size !== offsets.length ||
    offsets.some((offset) => !Number.isSafeInteger(offset) || !allowed.has(offset))
  ) {
    throw new AppError('Некорректные сроки напоминаний');
  }
}

export class ConsumableService {
  private readonly db: SqlDatabase;
  private readonly consumables: ConsumableRepository;
  private readonly items: ItemRepository;
  private readonly reminders: ReminderRepository;
  private readonly reminderService: ConsumableReminderService;

  constructor(db: SqlDatabase, notifications: NotificationAdapter) {
    this.db = db;
    this.consumables = new ConsumableRepository(db);
    this.items = new ItemRepository(db);
    this.reminders = new ReminderRepository(db);
    this.reminderService = new ConsumableReminderService(db, notifications);
  }

  listByItem(itemId: string): Consumable[] {
    return this.consumables.listByItemId(itemId);
  }

  getById(id: string): Consumable | null {
    return this.consumables.getById(id);
  }

  listEvents(consumableId: string): ConsumableEvent[] {
    return this.consumables.listEventsForConsumable(consumableId);
  }

  listForProperty(
    propertyId: string,
    filters: ConsumableListFilters,
    referenceDate: DateOnly = toLocalDateOnly(),
  ): ConsumableListRow[] {
    return this.consumables.listForProperty(propertyId, filters, referenceDate);
  }

  listAttentionForProperty(
    propertyId: string,
    aheadDays: number,
    referenceDate: DateOnly = toLocalDateOnly(),
  ): ConsumableListRow[] {
    return this.consumables.listAttentionForProperty(
      propertyId,
      aheadDays,
      referenceDate,
    );
  }

  async create(
    itemId: string,
    values: ConsumableFormValues,
  ): Promise<ConsumableSaveResult> {
    validateReminderOffsets(values.reminderOffsets);
    const item = this.items.getById(itemId);
    if (!item) throw new AppError('Вещь не найдена', { code: 'NOT_FOUND' });

    const trackSchedule =
      values.dueMode !== 'none' &&
      ((values.intervalValue != null && values.intervalUnit != null) ||
        values.nextDueDate != null);

    let nextDueDate: DateOnly | null = null;
    let intervalValue: number | null = null;
    let intervalUnit: IntervalUnit | null = null;

    if (trackSchedule) {
      intervalValue = values.intervalValue;
      intervalUnit = values.intervalUnit;
      if (values.dueMode === 'explicit') {
        nextDueDate = values.nextDueDate;
      } else if (values.dueMode === 'from_today') {
        nextDueDate = resolveInitialNextDue({
          dueMode: 'from_today',
          nextDueDate: null,
          intervalValue,
          intervalUnit,
        });
      } else if (values.nextDueDate) {
        nextDueDate = values.nextDueDate;
      }
    }

    const consumable = this.consumables.create({
      itemId,
      name: values.name,
      modelOrArticle: optionalText(values.modelOrArticle),
      manufacturer: optionalText(values.manufacturer),
      note: optionalText(values.note),
      stockQuantity: values.trackStock ? (values.stockQuantity ?? 0) : null,
      stockUnit: values.trackStock ? values.stockUnit : null,
      replacementIntervalValue: intervalValue,
      replacementIntervalUnit: intervalUnit,
      nextDueDate,
    });

    const reminders = await this.reminderService.reschedule(
      consumable.id,
      values.reminderOffsets,
      values.remindersEnabled && nextDueDate != null,
    );

    return { consumable, reminders };
  }

  async update(
    id: string,
    values: ConsumableFormValues,
  ): Promise<ConsumableSaveResult> {
    validateReminderOffsets(values.reminderOffsets);
    const existing = this.consumables.getById(id);
    if (!existing) throw new AppError('Расходник не найден', { code: 'NOT_FOUND' });

    const trackSchedule =
      values.dueMode !== 'none' &&
      ((values.intervalValue != null && values.intervalUnit != null) ||
        values.nextDueDate != null);

    let nextDueDate = existing.nextDueDate;
    let intervalValue = existing.replacementIntervalValue;
    let intervalUnit = existing.replacementIntervalUnit;

    if (!trackSchedule) {
      nextDueDate = null;
      intervalValue = null;
      intervalUnit = null;
    } else {
      intervalValue = values.intervalValue;
      intervalUnit = values.intervalUnit;
      if (values.dueMode === 'explicit' && values.nextDueDate) {
        nextDueDate = values.nextDueDate;
      } else if (values.nextDueDate) {
        nextDueDate = values.nextDueDate;
      }
    }

    const consumable = this.consumables.update(id, {
      name: values.name,
      modelOrArticle: optionalText(values.modelOrArticle),
      manufacturer: optionalText(values.manufacturer),
      note: optionalText(values.note),
      stockQuantity: values.trackStock ? (values.stockQuantity ?? 0) : null,
      stockUnit: values.trackStock ? values.stockUnit : null,
      clearStock: !values.trackStock,
      replacementIntervalValue: intervalValue,
      replacementIntervalUnit: intervalUnit,
      nextDueDate,
      clearSchedule: !trackSchedule,
    });

    const reminders = await this.reminderService.reschedule(
      consumable.id,
      values.reminderOffsets,
      values.remindersEnabled && consumable.nextDueDate != null,
    );

    return { consumable, reminders };
  }

  /**
   * Mark replaced: event + optional stock decrement + next due, then reminders.
   */
  async markReplaced(
    consumableId: string,
    performedDate: DateOnly = toLocalDateOnly(),
    note?: string | null,
    options?: { allowZeroStock?: boolean },
  ): Promise<MarkReplacedResult> {
    const existing = this.consumables.getById(consumableId);
    if (!existing) throw new AppError('Расходник не найден', { code: 'NOT_FOUND' });

    const latest = this.consumables.getLatestReplacementEvent(consumableId);
    const latestDate = latest ? utcInstantToDateOnly(latest.replacedAt) : null;
    if (latestDate && performedDate < latestDate) {
      const event = this.consumables.createEvent({
        itemId: existing.itemId,
        consumableId,
        eventType: 'replacement',
        occurredDate: performedDate,
        note: note ?? null,
      });
      return {
        event,
        consumable: existing,
        reminders: { permissionDenied: false, scheduledCount: 0, failedCount: 0 },
        stockWasZero: false,
      };
    }

    const stockWasZero = existing.stockQuantity === 0;
    if (stockWasZero && !options?.allowZeroStock) {
      throw new AppError('STOCK_ZERO_CONFIRM', { code: 'STOCK_ZERO_CONFIRM' });
    }

    const preferred = this.recoverReminderPrefs(consumableId, existing.nextDueDate);

    const { event, consumable } = this.db.withTransaction(() => {
      let stockBefore = existing.stockQuantity;
      let stockAfter = existing.stockQuantity;

      if (existing.stockQuantity != null && existing.stockQuantity > 0) {
        stockAfter = existing.stockQuantity - 1;
      }

      const created = this.consumables.createEvent({
        itemId: existing.itemId,
        consumableId,
        eventType: 'replacement',
        occurredDate: performedDate,
        quantityDelta:
          stockBefore != null && stockAfter != null
            ? stockAfter - stockBefore
            : null,
        stockBefore,
        stockAfter,
        note: note ?? null,
      });

      const nextDue = computeNextDueDate(
        performedDate,
        existing.replacementIntervalValue,
        existing.replacementIntervalUnit,
      );

      const updated = this.consumables.update(consumableId, {
        lastReplacedDate: performedDate,
        nextDueDate: nextDue,
        stockQuantity: stockAfter,
      });

      return { event: created, consumable: updated };
    });

    const reminders = await this.reminderService.reschedule(
      consumableId,
      preferred.offsets,
      preferred.enabled && consumable.nextDueDate != null,
    );

    return { event, consumable, reminders, stockWasZero };
  }

  /** Add to stock without changing replacement schedule. */
  async addStock(
    consumableId: string,
    amount: number,
    note?: string | null,
  ): Promise<{ consumable: Consumable; event: ConsumableEvent }> {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new AppError('Укажите целое положительное количество');
    }
    const existing = this.consumables.getById(consumableId);
    if (!existing) throw new AppError('Расходник не найден', { code: 'NOT_FOUND' });
    if (existing.stockQuantity == null) {
      throw new AppError('Для этого расходника запас не ведётся');
    }

    return this.db.withTransaction(() => {
      const stockBefore = existing.stockQuantity!;
      const stockAfter = stockBefore + amount;
      if (!Number.isSafeInteger(stockAfter)) {
        throw new AppError('Количество превышает допустимое значение');
      }
      const event = this.consumables.createEvent({
        itemId: existing.itemId,
        consumableId,
        eventType: 'stock_add',
        occurredDate: toLocalDateOnly(),
        quantityDelta: amount,
        stockBefore,
        stockAfter,
        note: note ?? null,
      });
      const consumable = this.consumables.update(consumableId, {
        stockQuantity: stockAfter,
        stockUnit: existing.stockUnit,
      });
      return { consumable, event };
    });
  }

  /** Set absolute stock without changing replacement schedule. */
  async setStock(
    consumableId: string,
    quantity: number,
    note?: string | null,
  ): Promise<{ consumable: Consumable; event: ConsumableEvent }> {
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      throw new AppError('Количество должно быть целым и не меньше нуля');
    }
    const existing = this.consumables.getById(consumableId);
    if (!existing) throw new AppError('Расходник не найден', { code: 'NOT_FOUND' });

    return this.db.withTransaction(() => {
      const stockBefore = existing.stockQuantity;
      const event = this.consumables.createEvent({
        itemId: existing.itemId,
        consumableId,
        eventType: 'stock_set',
        occurredDate: toLocalDateOnly(),
        quantityDelta:
          stockBefore != null ? quantity - stockBefore : null,
        stockBefore,
        stockAfter: quantity,
        note: note ?? null,
      });
      const consumable = this.consumables.update(consumableId, {
        stockQuantity: quantity,
        stockUnit: existing.stockUnit ?? 'pcs',
      });
      return { consumable, event };
    });
  }

  async addHistoryReplacement(
    consumableId: string,
    performedDate: DateOnly,
    note?: string | null,
  ): Promise<MarkReplacedResult> {
    const existing = this.consumables.getById(consumableId);
    if (!existing) throw new AppError('Расходник не найден', { code: 'NOT_FOUND' });

    const latest = this.consumables.getLatestReplacementEvent(consumableId);
    const latestDate = latest
      ? utcInstantToDateOnly(latest.replacedAt)
      : null;
    const isNewest =
      !latestDate || performedDate >= latestDate;

    if (!isNewest) {
      // Old backdated replacement: record history only, do not move schedule/stock.
      const event = this.consumables.createEvent({
        itemId: existing.itemId,
        consumableId,
        eventType: 'replacement',
        occurredDate: performedDate,
        note: note ?? null,
      });
      return {
        event,
        consumable: existing,
        reminders: {
          permissionDenied: false,
          scheduledCount: 0,
          failedCount: 0,
        },
        stockWasZero: false,
      };
    }

    return this.markReplaced(consumableId, performedDate, note, {
      allowZeroStock: true,
    });
  }

  async delete(id: string): Promise<void> {
    await this.reminderService.cancelForConsumable(id);
    this.consumables.delete(id);
  }

  private recoverReminderPrefs(
    consumableId: string,
    nextDueDate: DateOnly | null,
  ): { offsets: number[]; enabled: boolean } {
    const rows = this.reminders.listByConsumableId(consumableId);
    if (rows.length === 0 || !nextDueDate) {
      return { offsets: [0], enabled: true };
    }
    const offsets = [
      ...new Set(
        rows.map((row) => {
          const fireDateOnly = toLocalDateOnly(new Date(row.dueAt));
          return daysUntilDateOnly(nextDueDate, fireDateOnly);
        }),
      ),
    ].filter((offset) => Number.isInteger(offset) && offset >= 0);

    return {
      offsets: offsets.length > 0 ? offsets : [0],
      enabled: rows.some((row) => row.enabled),
    };
  }
}
