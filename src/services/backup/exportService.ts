/**
 * Human-readable CSV exports (not a backup).
 */

import type { SqlDatabase } from '@/src/db/types';
import { buildCsv, formatMinorForCsv } from '@/src/utils/csv';
import {
  computeWarrantyStatus,
  resolveWarrantyEndDate,
} from '@/src/utils/warrantyDate';
import { WARRANTY_TYPE_LABELS } from '@/src/domain/warranty';
import type { WarrantyType } from '@/src/domain/warranty';
import { toLocalDateOnly } from '@/src/utils/datetime';

export type CsvExportKind =
  | 'inventory'
  | 'warranties'
  | 'maintenance'
  | 'consumables';

export class ExportService {
  constructor(private readonly db: SqlDatabase) {}

  buildCsv(kind: CsvExportKind, propertyId?: string | null): string {
    switch (kind) {
      case 'inventory':
        return this.inventoryCsv(propertyId);
      case 'warranties':
        return this.warrantiesCsv(propertyId);
      case 'maintenance':
        return this.maintenanceCsv(propertyId);
      case 'consumables':
        return this.consumablesCsv(propertyId);
      default: {
        const _exhaustive: never = kind;
        return _exhaustive;
      }
    }
  }

  fileName(kind: CsvExportKind): string {
    const date = toLocalDateOnly();
    const map: Record<CsvExportKind, string> = {
      inventory: 'imushchestvo',
      warranties: 'garantii',
      maintenance: 'obsluzhivanie',
      consumables: 'rashodniki',
    };
    return `my-home-${map[kind]}-${date}.csv`;
  }

  private inventoryCsv(propertyId?: string | null): string {
    const params: string[] = [];
    let sql = `
      SELECT i.name, i.category, i.brand, i.model, i.serial_number,
             l.name AS location_name,
             p.purchase_date, p.seller, p.price_minor
      FROM items i
      LEFT JOIN locations l ON l.id = i.location_id
      LEFT JOIN purchases p ON p.item_id = i.id
      WHERE i.status = 'active'
    `;
    if (propertyId) {
      sql += ' AND i.property_id = ?';
      params.push(propertyId);
    }
    sql += ' ORDER BY i.name COLLATE NOCASE';
    const rows = this.db.getAll<{
      name: string;
      category: string;
      brand: string | null;
      model: string | null;
      serial_number: string | null;
      location_name: string | null;
      purchase_date: string | null;
      seller: string | null;
      price_minor: number | null;
    }>(sql, params);

    return buildCsv(
      [
        'Название',
        'Категория',
        'Бренд',
        'Модель',
        'Серийный номер',
        'Комната',
        'Дата покупки',
        'Магазин',
        'Цена',
      ],
      rows.map((row) => [
        row.name,
        row.category,
        row.brand,
        row.model,
        row.serial_number,
        row.location_name,
        row.purchase_date,
        row.seller,
        formatMinorForCsv(row.price_minor),
      ]),
    );
  }

  private warrantiesCsv(propertyId?: string | null): string {
    const params: string[] = [];
    let sql = `
      SELECT i.name AS item_name, w.type, w.provider, w.start_date, w.end_date,
             w.duration_months
      FROM warranties w
      JOIN items i ON i.id = w.item_id
      WHERE i.status = 'active'
    `;
    if (propertyId) {
      sql += ' AND i.property_id = ?';
      params.push(propertyId);
    }
    sql += ' ORDER BY i.name COLLATE NOCASE';
    const rows = this.db.getAll<{
      item_name: string;
      type: string;
      provider: string | null;
      start_date: string | null;
      end_date: string | null;
      duration_months: number | null;
    }>(sql, params);

    return buildCsv(
      ['Вещь', 'Тип гарантии', 'Провайдер', 'Начало', 'Конец', 'Статус'],
      rows.map((row) => {
        const end = resolveWarrantyEndDate({
          endDate: row.end_date,
          startDate: row.start_date,
          durationMonths: row.duration_months,
        });
        const status = computeWarrantyStatus(end);
        const statusLabel =
          status === 'expired'
            ? 'Истекла'
            : status === 'expiring_soon'
              ? 'Скоро истекает'
              : status === 'active'
                ? 'Действует'
                : 'Неизвестно';
        return [
          row.item_name,
          WARRANTY_TYPE_LABELS[row.type as WarrantyType] ?? row.type,
          row.provider,
          row.start_date,
          end,
          statusLabel,
        ];
      }),
    );
  }

  private maintenanceCsv(propertyId?: string | null): string {
    const params: string[] = [];
    let sql = `
      SELECT i.name AS item_name, r.title, r.interval_value, r.interval_unit,
             r.next_due_date, r.last_completed_date
      FROM maintenance_rules r
      JOIN items i ON i.id = r.item_id
      WHERE i.status = 'active' AND r.enabled = 1
    `;
    if (propertyId) {
      sql += ' AND i.property_id = ?';
      params.push(propertyId);
    }
    sql += ' ORDER BY i.name COLLATE NOCASE';
    const rows = this.db.getAll<{
      item_name: string;
      title: string;
      interval_value: number | null;
      interval_unit: string | null;
      next_due_date: string | null;
      last_completed_date: string | null;
    }>(sql, params);

    return buildCsv(
      [
        'Вещь',
        'Правило',
        'Интервал',
        'Единица',
        'Следующее ТО',
        'Последнее ТО',
      ],
      rows.map((row) => [
        row.item_name,
        row.title,
        row.interval_value,
        row.interval_unit,
        row.next_due_date,
        row.last_completed_date,
      ]),
    );
  }

  private consumablesCsv(propertyId?: string | null): string {
    const params: string[] = [];
    let sql = `
      SELECT i.name AS item_name, c.name, c.manufacturer, c.model_or_article,
             c.stock_quantity, c.stock_unit, c.next_due_date
      FROM consumables c
      JOIN items i ON i.id = c.item_id
      WHERE i.status = 'active' AND c.active = 1
    `;
    if (propertyId) {
      sql += ' AND i.property_id = ?';
      params.push(propertyId);
    }
    sql += ' ORDER BY i.name COLLATE NOCASE';
    const rows = this.db.getAll<{
      item_name: string;
      name: string;
      manufacturer: string | null;
      model_or_article: string | null;
      stock_quantity: number | null;
      stock_unit: string | null;
      next_due_date: string | null;
    }>(sql, params);

    return buildCsv(
      [
        'Вещь',
        'Расходник',
        'Производитель',
        'Артикул',
        'Запас',
        'Единица',
        'Следующая замена',
      ],
      rows.map((row) => [
        row.item_name,
        row.name,
        row.manufacturer,
        row.model_or_article,
        row.stock_quantity,
        row.stock_unit,
        row.next_due_date,
      ]),
    );
  }
}
