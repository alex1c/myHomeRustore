/**
 * Consumable repository — definitions and typed stock/replacement events.
 */

import { AppError } from '@/src/domain/errors';
import { createEntityIdSync } from '@/src/domain/ids';
import type {
  Consumable,
  ConsumableEvent,
  ConsumableEventType,
  ConsumableStockUnit,
  DateOnly,
  IntervalUnit,
} from '@/src/domain/types';
import type { ConsumableListFilters } from '@/src/domain/consumables';
import type { SqlDatabase } from '@/src/db/types';
import {
  dateOnlyToUtcNoon,
  nowUtcInstant,
} from '@/src/utils/datetime';
import {
  computeConsumableAttentionKind,
  consumableAttentionSortKey,
} from '@/src/utils/consumableDate';
import { daysUntilDateOnly } from '@/src/utils/warrantyDate';

type ConsumableRow = {
  id: string;
  item_id: string;
  name: string;
  model_or_article: string | null;
  manufacturer: string | null;
  replacement_interval_value: number | null;
  replacement_interval_unit: string | null;
  last_replaced_date: string | null;
  next_due_date: string | null;
  stock_quantity: number | null;
  stock_unit: string | null;
  price_minor: number | null;
  note: string | null;
  active: number;
  created_at: string;
  updated_at: string;
};

type EventRow = {
  id: string;
  item_id: string;
  consumable_id: string;
  event_type: string;
  replaced_at: string;
  quantity_delta: number | null;
  stock_before: number | null;
  stock_after: number | null;
  cost_minor: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type ConsumableListRow = {
  consumable: Consumable;
  itemId: string;
  itemName: string;
  itemBrand: string | null;
  itemModel: string | null;
  daysUntilDue: number | null;
};

function mapConsumable(row: ConsumableRow): Consumable {
  return {
    id: row.id,
    itemId: row.item_id,
    name: row.name,
    modelOrArticle: row.model_or_article,
    manufacturer: row.manufacturer,
    replacementIntervalValue: row.replacement_interval_value,
    replacementIntervalUnit:
      row.replacement_interval_unit as Consumable['replacementIntervalUnit'],
    lastReplacedDate: row.last_replaced_date,
    nextDueDate: row.next_due_date,
    stockQuantity: row.stock_quantity,
    stockUnit: row.stock_unit as ConsumableStockUnit | null,
    priceMinor: row.price_minor,
    note: row.note,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvent(row: EventRow): ConsumableEvent {
  return {
    id: row.id,
    itemId: row.item_id,
    consumableId: row.consumable_id,
    eventType: row.event_type as ConsumableEventType,
    replacedAt: row.replaced_at,
    quantityDelta: row.quantity_delta,
    stockBefore: row.stock_before,
    stockAfter: row.stock_after,
    costMinor: row.cost_minor,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

export class ConsumableRepository {
  constructor(private readonly db: SqlDatabase) {}

  create(input: {
    itemId: string;
    name: string;
    modelOrArticle?: string | null;
    manufacturer?: string | null;
    replacementIntervalValue?: number | null;
    replacementIntervalUnit?: IntervalUnit | null;
    lastReplacedDate?: DateOnly | null;
    nextDueDate?: DateOnly | null;
    stockQuantity?: number | null;
    stockUnit?: ConsumableStockUnit | null;
    note?: string | null;
  }): Consumable {
    const name = input.name.trim();
    if (!name) throw new AppError('Введите название расходника');
    if (input.stockQuantity != null) {
      if (!Number.isInteger(input.stockQuantity) || input.stockQuantity < 0) {
        throw new AppError('Количество должно быть целым и не меньше нуля');
      }
    }

    const id = createEntityIdSync();
    const now = nowUtcInstant();
    this.db.run(
      `INSERT INTO consumables
       (id, item_id, name, model_or_article, manufacturer,
        replacement_interval_value, replacement_interval_unit,
        last_replaced_date, next_due_date, stock_quantity, stock_unit,
        price_minor, note, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 1, ?, ?)`,
      [
        id,
        input.itemId,
        name,
        input.modelOrArticle ?? null,
        input.manufacturer ?? null,
        input.replacementIntervalValue ?? null,
        input.replacementIntervalUnit ?? null,
        input.lastReplacedDate ?? null,
        input.nextDueDate ?? null,
        input.stockQuantity ?? null,
        input.stockQuantity != null ? (input.stockUnit ?? 'pcs') : null,
        input.note ?? null,
        now,
        now,
      ],
    );
    return this.getById(id)!;
  }

  getById(id: string): Consumable | null {
    const row = this.db.getFirst<ConsumableRow>(
      'SELECT * FROM consumables WHERE id = ?',
      [id],
    );
    return row ? mapConsumable(row) : null;
  }

  listByItemId(itemId: string): Consumable[] {
    const rows = this.db.getAll<ConsumableRow>(
      `SELECT * FROM consumables
       WHERE item_id = ? AND active = 1
       ORDER BY next_due_date IS NULL, next_due_date ASC, name COLLATE NOCASE`,
      [itemId],
    );
    return rows.map(mapConsumable);
  }

  update(
    id: string,
    input: {
      name?: string;
      modelOrArticle?: string | null;
      manufacturer?: string | null;
      replacementIntervalValue?: number | null;
      replacementIntervalUnit?: IntervalUnit | null;
      lastReplacedDate?: DateOnly | null;
      nextDueDate?: DateOnly | null;
      stockQuantity?: number | null;
      stockUnit?: ConsumableStockUnit | null;
      note?: string | null;
      clearSchedule?: boolean;
      clearStock?: boolean;
    },
  ): Consumable {
    const existing = this.getById(id);
    if (!existing) {
      throw new AppError('Расходник не найден', { code: 'NOT_FOUND' });
    }

    const name = input.name !== undefined ? input.name.trim() : existing.name;
    if (!name) throw new AppError('Введите название расходника');

    let stockQuantity = existing.stockQuantity;
    let stockUnit = existing.stockUnit;
    if (input.clearStock) {
      stockQuantity = null;
      stockUnit = null;
    } else if (input.stockQuantity !== undefined) {
      if (input.stockQuantity != null) {
        if (!Number.isInteger(input.stockQuantity) || input.stockQuantity < 0) {
          throw new AppError('Количество должно быть целым и не меньше нуля');
        }
      }
      stockQuantity = input.stockQuantity;
      stockUnit =
        stockQuantity == null
          ? null
          : (input.stockUnit ?? existing.stockUnit ?? 'pcs');
    } else if (input.stockUnit !== undefined && stockQuantity != null) {
      stockUnit = input.stockUnit;
    }

    const nextDueDate = input.clearSchedule
      ? null
      : input.nextDueDate !== undefined
        ? input.nextDueDate
        : existing.nextDueDate;
    const intervalValue = input.clearSchedule
      ? null
      : input.replacementIntervalValue !== undefined
        ? input.replacementIntervalValue
        : existing.replacementIntervalValue;
    const intervalUnit = input.clearSchedule
      ? null
      : input.replacementIntervalUnit !== undefined
        ? input.replacementIntervalUnit
        : existing.replacementIntervalUnit;

    const now = nowUtcInstant();
    this.db.run(
      `UPDATE consumables SET
        name = ?,
        model_or_article = ?,
        manufacturer = ?,
        replacement_interval_value = ?,
        replacement_interval_unit = ?,
        last_replaced_date = ?,
        next_due_date = ?,
        stock_quantity = ?,
        stock_unit = ?,
        note = ?,
        updated_at = ?
       WHERE id = ?`,
      [
        name,
        input.modelOrArticle !== undefined
          ? input.modelOrArticle
          : existing.modelOrArticle,
        input.manufacturer !== undefined
          ? input.manufacturer
          : existing.manufacturer,
        intervalValue,
        intervalUnit,
        input.lastReplacedDate !== undefined
          ? input.lastReplacedDate
          : existing.lastReplacedDate,
        nextDueDate,
        stockQuantity,
        stockUnit,
        input.note !== undefined ? input.note : existing.note,
        now,
        id,
      ],
    );
    return this.getById(id)!;
  }

  delete(id: string): void {
    const existing = this.getById(id);
    if (!existing) {
      throw new AppError('Расходник не найден', { code: 'NOT_FOUND' });
    }
    this.db.run('DELETE FROM consumables WHERE id = ?', [id]);
  }

  createEvent(input: {
    itemId: string;
    consumableId: string;
    eventType: ConsumableEventType;
    occurredDate: DateOnly;
    quantityDelta?: number | null;
    stockBefore?: number | null;
    stockAfter?: number | null;
    note?: string | null;
  }): ConsumableEvent {
    const id = createEntityIdSync();
    const now = nowUtcInstant();
    this.db.run(
      `INSERT INTO consumable_events
       (id, item_id, consumable_id, event_type, replaced_at,
        quantity_delta, stock_before, stock_after, cost_minor, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      [
        id,
        input.itemId,
        input.consumableId,
        input.eventType,
        dateOnlyToUtcNoon(input.occurredDate),
        input.quantityDelta ?? null,
        input.stockBefore ?? null,
        input.stockAfter ?? null,
        input.note ?? null,
        now,
        now,
      ],
    );
    return this.getEventById(id)!;
  }

  getEventById(id: string): ConsumableEvent | null {
    const row = this.db.getFirst<EventRow>(
      'SELECT * FROM consumable_events WHERE id = ?',
      [id],
    );
    return row ? mapEvent(row) : null;
  }

  listEventsForConsumable(consumableId: string): ConsumableEvent[] {
    const rows = this.db.getAll<EventRow>(
      `SELECT * FROM consumable_events
       WHERE consumable_id = ?
       ORDER BY replaced_at DESC, created_at DESC`,
      [consumableId],
    );
    return rows.map(mapEvent);
  }

  getLatestReplacementEvent(consumableId: string): ConsumableEvent | null {
    const row = this.db.getFirst<EventRow>(
      `SELECT * FROM consumable_events
       WHERE consumable_id = ? AND event_type = 'replacement'
       ORDER BY replaced_at DESC, created_at DESC
       LIMIT 1`,
      [consumableId],
    );
    return row ? mapEvent(row) : null;
  }

  listForProperty(
    propertyId: string,
    filters: ConsumableListFilters,
    referenceDate: DateOnly,
  ): ConsumableListRow[] {
    const params: (string | number)[] = [propertyId];
    let sql = `
      SELECT c.*,
        i.name AS item_name,
        i.brand AS item_brand,
        i.model AS item_model
      FROM consumables c
      JOIN items i ON i.id = c.item_id
      WHERE i.property_id = ? AND i.status = 'active' AND c.active = 1
    `;

    const search = filters.search.trim();
    if (search) {
      const like = `%${escapeLike(search)}%`;
      sql += ` AND (
        c.name LIKE ? ESCAPE '\\' OR
        IFNULL(c.model_or_article, '') LIKE ? ESCAPE '\\' OR
        IFNULL(c.manufacturer, '') LIKE ? ESCAPE '\\' OR
        i.name LIKE ? ESCAPE '\\' OR
        IFNULL(i.brand, '') LIKE ? ESCAPE '\\' OR
        IFNULL(i.model, '') LIKE ? ESCAPE '\\'
      )`;
      params.push(like, like, like, like, like, like);
    }

    const rows = this.db.getAll<
      ConsumableRow & {
        item_name: string;
        item_brand: string | null;
        item_model: string | null;
      }
    >(sql, params);

    let mapped: ConsumableListRow[] = rows.map((row) => {
      const consumable = mapConsumable(row);
      return {
        consumable,
        itemId: consumable.itemId,
        itemName: row.item_name,
        itemBrand: row.item_brand,
        itemModel: row.item_model,
        daysUntilDue:
          consumable.nextDueDate != null
            ? daysUntilDateOnly(consumable.nextDueDate, referenceDate)
            : null,
      };
    });

    if (filters.filter === 'out_of_stock') {
      mapped = mapped.filter((row) => row.consumable.stockQuantity === 0);
    } else if (filters.filter === 'attention') {
      mapped = mapped.filter((row) => {
        const kind = computeConsumableAttentionKind({
          stockQuantity: row.consumable.stockQuantity,
          nextDueDate: row.consumable.nextDueDate,
          referenceDate,
        });
        return (
          kind === 'out_of_stock' ||
          kind === 'overdue' ||
          kind === 'today' ||
          kind === 'tomorrow' ||
          kind === 'upcoming'
        );
      });
    }

    return mapped.sort((a, b) => {
      const ak = consumableAttentionSortKey(
        computeConsumableAttentionKind({
          stockQuantity: a.consumable.stockQuantity,
          nextDueDate: a.consumable.nextDueDate,
          referenceDate,
        }),
      );
      const bk = consumableAttentionSortKey(
        computeConsumableAttentionKind({
          stockQuantity: b.consumable.stockQuantity,
          nextDueDate: b.consumable.nextDueDate,
          referenceDate,
        }),
      );
      if (ak !== bk) return ak - bk;
      const ad = a.daysUntilDue;
      const bd = b.daysUntilDue;
      if (ad == null && bd == null) return a.consumable.name.localeCompare(b.consumable.name);
      if (ad == null) return 1;
      if (bd == null) return -1;
      return ad - bd;
    });
  }

  listAttentionForProperty(
    propertyId: string,
    aheadDays: number,
    referenceDate: DateOnly,
  ): ConsumableListRow[] {
    const all = this.listForProperty(
      propertyId,
      { search: '', filter: 'all' },
      referenceDate,
    );
    return all
      .filter((row) => {
        const kind = computeConsumableAttentionKind({
          stockQuantity: row.consumable.stockQuantity,
          nextDueDate: row.consumable.nextDueDate,
          referenceDate,
          aheadDays,
        });
        return (
          kind === 'out_of_stock' ||
          kind === 'overdue' ||
          kind === 'today' ||
          kind === 'tomorrow' ||
          kind === 'upcoming'
        );
      })
      .sort((a, b) => {
        const ak = consumableAttentionSortKey(
          computeConsumableAttentionKind({
            stockQuantity: a.consumable.stockQuantity,
            nextDueDate: a.consumable.nextDueDate,
            referenceDate,
            aheadDays,
          }),
        );
        const bk = consumableAttentionSortKey(
          computeConsumableAttentionKind({
            stockQuantity: b.consumable.stockQuantity,
            nextDueDate: b.consumable.nextDueDate,
            referenceDate,
            aheadDays,
          }),
        );
        if (ak !== bk) return ak - bk;
        return (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0);
      });
  }
}
