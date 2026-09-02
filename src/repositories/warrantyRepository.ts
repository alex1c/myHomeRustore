/**
 * Warranty repository — multiple warranties per item supported.
 */

import { AppError } from '@/src/domain/errors';
import { createEntityIdSync } from '@/src/domain/ids';
import type { Warranty } from '@/src/domain/types';
import type { WarrantyType } from '@/src/domain/warranty';
import type { SqlDatabase } from '@/src/db/types';
import { isValidDateOnly, nowUtcInstant } from '@/src/utils/datetime';
import { resolveWarrantyEndDate } from '@/src/utils/warrantyDate';

type WarrantyRow = {
  id: string;
  item_id: string;
  type: string;
  provider: string | null;
  start_date: string | null;
  end_date: string | null;
  duration_months: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: WarrantyRow): Warranty {
  return {
    id: row.id,
    itemId: row.item_id,
    type: row.type,
    provider: row.provider,
    startDate: row.start_date,
    endDate: row.end_date,
    durationMonths: row.duration_months,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface WarrantyCreateInput {
  itemId: string;
  type: WarrantyType;
  provider?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  durationMonths?: number | null;
  note?: string | null;
}

export interface WarrantyUpdateInput {
  type?: WarrantyType;
  provider?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  durationMonths?: number | null;
  note?: string | null;
  clearEndDate?: boolean;
  clearDuration?: boolean;
}

export interface WarrantyAttentionRow {
  warranty: Warranty;
  itemId: string;
  itemName: string;
  resolvedEndDate: string;
  daysUntilEnd: number;
}

export class WarrantyRepository {
  constructor(private readonly db: SqlDatabase) {}

  getById(id: string): Warranty | null {
    const row = this.db.getFirst<WarrantyRow>(
      'SELECT * FROM warranties WHERE id = ?',
      [id],
    );
    return row ? mapRow(row) : null;
  }

  listByItemId(itemId: string): Warranty[] {
    const rows = this.db.getAll<WarrantyRow>(
      `SELECT * FROM warranties WHERE item_id = ?
       ORDER BY end_date IS NULL, end_date ASC, created_at DESC`,
      [itemId],
    );
    return rows.map(mapRow);
  }

  create(input: WarrantyCreateInput): Warranty {
    this.validateDates(input.startDate ?? null, input.endDate ?? null, input.durationMonths ?? null);

    const id = createEntityIdSync();
    const now = nowUtcInstant();
    this.db.run(
      `INSERT INTO warranties
       (id, item_id, type, provider, start_date, end_date, duration_months, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.itemId,
        input.type,
        input.provider ?? null,
        input.startDate ?? null,
        input.endDate ?? null,
        input.durationMonths ?? null,
        input.note ?? null,
        now,
        now,
      ],
    );
    return this.getById(id)!;
  }

  update(id: string, input: WarrantyUpdateInput): Warranty {
    const existing = this.getById(id);
    if (!existing) {
      throw new AppError('Гарантия не найдена', { code: 'NOT_FOUND' });
    }

    const endDate = input.clearEndDate
      ? null
      : input.endDate !== undefined
        ? input.endDate
        : existing.endDate;
    const durationMonths = input.clearDuration
      ? null
      : input.durationMonths !== undefined
        ? input.durationMonths
        : existing.durationMonths;

    const startDate = input.startDate !== undefined ? input.startDate : existing.startDate;
    this.validateDates(startDate, endDate, durationMonths);

    const now = nowUtcInstant();
    this.db.run(
      `UPDATE warranties SET
        type = ?,
        provider = ?,
        start_date = ?,
        end_date = ?,
        duration_months = ?,
        note = ?,
        updated_at = ?
       WHERE id = ?`,
      [
        input.type ?? existing.type,
        input.provider !== undefined ? input.provider : existing.provider,
        startDate,
        endDate,
        durationMonths,
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
      throw new AppError('Гарантия не найдена', { code: 'NOT_FOUND' });
    }
    this.db.run('DELETE FROM warranties WHERE id = ?', [id]);
  }

  /** Warranties expiring within `daysAhead` or expired within `daysPast`. */
  listAttentionForProperty(
    propertyId: string,
    daysAhead: number,
    daysPast: number,
    referenceDate: string,
  ): WarrantyAttentionRow[] {
    const rows = this.db.getAll<WarrantyRow & { item_name: string }>(
      `SELECT w.*, i.name AS item_name
       FROM warranties w
       JOIN items i ON i.id = w.item_id
       WHERE i.property_id = ? AND i.status = 'active'`,
      [propertyId],
    );

    const result: WarrantyAttentionRow[] = [];
    for (const row of rows) {
      const warranty = mapRow(row);
      const resolvedEnd = resolveWarrantyEndDate(warranty);
      if (!resolvedEnd) continue;

      const [ey, em, ed] = resolvedEnd.split('-').map(Number);
      const [ry, rm, rd] = referenceDate.split('-').map(Number);
      const endMs = Date.UTC(ey, em - 1, ed);
      const refMs = Date.UTC(ry, rm - 1, rd);
      const daysUntilEnd = Math.round((endMs - refMs) / 86_400_000);

      if (daysUntilEnd <= daysAhead && daysUntilEnd >= -daysPast) {
        result.push({
          warranty,
          itemId: warranty.itemId,
          itemName: row.item_name,
          resolvedEndDate: resolvedEnd,
          daysUntilEnd,
        });
      }
    }

    return result.sort((a, b) => a.daysUntilEnd - b.daysUntilEnd);
  }

  private validateDates(
    startDate: string | null,
    endDate: string | null,
    durationMonths: number | null,
  ): void {
    if ((endDate == null) === (durationMonths == null)) {
      throw new AppError('Укажите либо срок гарантии, либо дату окончания');
    }
    if (startDate != null && !isValidDateOnly(startDate)) {
      throw new AppError('Некорректная дата начала гарантии');
    }
    if (endDate != null && !isValidDateOnly(endDate)) {
      throw new AppError('Некорректная дата окончания гарантии');
    }
    if (durationMonths != null && (!Number.isInteger(durationMonths) || durationMonths <= 0)) {
      throw new AppError('Срок гарантии должен быть целым числом больше нуля');
    }
    if (durationMonths != null && startDate == null) {
      throw new AppError('Для срока в месяцах укажите дату начала гарантии');
    }
    if (startDate != null && endDate != null && startDate > endDate) {
      throw new AppError('Дата окончания не может быть раньше даты начала');
    }
  }

  private validateDurationEnd(
    endDate: string | null,
    durationMonths: number | null,
  ): void {
    if (endDate != null && durationMonths != null) {
      throw new AppError('Укажите срок в месяцах или дату окончания, но не оба');
    }
    if (durationMonths != null && durationMonths <= 0) {
      throw new AppError('Срок гарантии должен быть больше нуля');
    }
  }
}
